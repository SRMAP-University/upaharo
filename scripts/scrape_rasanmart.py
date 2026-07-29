"""Scrape all products with image links and categories from rasanmart.com."""

from __future__ import annotations

import csv
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://rasanmart.com"
ALL_PRODUCTS_URL = f"{BASE_URL}/all-products"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}


def normalize_image_url(src: str | None) -> str | None:
    if not src or src.rstrip("/").endswith("products/small"):
        return None
    if src.startswith("http"):
        return src
    if src.startswith("/"):
        return f"{BASE_URL}{src}"
    return f"{BASE_URL}/{src.lstrip('/')}"


def parse_price(text: str) -> dict[str, str | None]:
    text = re.sub(r"\s+", " ", text.strip())
    prices = re.findall(r"NRs\.\s*([\d,]+(?:\.\d+)?)", text)
    if not prices:
        prices = re.findall(r"Rs\.\s*([\d,]+(?:\.\d+)?)", text)
    if len(prices) >= 2:
        return {"price": prices[0].replace(",", ""), "original_price": prices[1].replace(",", "")}
    if len(prices) == 1:
        return {"price": prices[0].replace(",", ""), "original_price": None}
    return {"price": None, "original_price": None}


def extract_product_id(grid: BeautifulSoup, product_url: str | None) -> str | None:
    product_id_input = grid.select_one('input[name="product_id"]')
    if product_id_input and product_id_input.get("value"):
        return product_id_input["value"]
    if product_url:
        match = re.search(r"/product-details/(\d+)", product_url)
        if match:
            return match.group(1)
    return None


def extract_products(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    products: list[dict] = []

    for grid in soup.select("div.product-grid4"):
        link = grid.select_one("div.product-image4 a[href]")
        img = grid.select_one("img.pic-1")
        title_el = grid.select_one("h3.title a")
        price_el = grid.select_one("div.price")

        if not title_el:
            continue

        name = title_el.get_text(strip=True)
        product_url = urljoin(BASE_URL, link["href"]) if link and link.get("href") else None
        image_url = normalize_image_url(img.get("src") if img else None)
        product_id = extract_product_id(grid, product_url)
        price_info = parse_price(price_el.get_text(" ", strip=True) if price_el else "")
        out_of_stock = bool(grid.find(string=re.compile(r"Out of Stock", re.I)))

        products.append(
            {
                "id": product_id,
                "name": name,
                "price": price_info["price"],
                "original_price": price_info["original_price"],
                "image_url": image_url,
                "product_url": product_url,
                "in_stock": not out_of_stock,
            }
        )

    return products


def get_last_page(html: str) -> int:
    soup = BeautifulSoup(html, "html.parser")
    pages: list[int] = []
    for link in soup.select("ul.pagination a.page-link"):
        href = link.get("href", "")
        match = re.search(r"[?&]page=(\d+)", href)
        if match:
            pages.append(int(match.group(1)))
    return max(pages) if pages else 1


def fetch_categories(session: requests.Session) -> list[dict[str, str]]:
    resp = session.get(BASE_URL, timeout=60)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    categories: list[dict[str, str]] = []
    seen: set[str] = set()

    for link in soup.select('a.dropdown-item[href*="/product-category/"]'):
        href = link.get("href", "")
        match = re.search(r"/product-category/(\d+)", href)
        if not match:
            continue
        category_id = match.group(1)
        if category_id in seen:
            continue
        seen.add(category_id)
        categories.append(
            {
                "category_id": category_id,
                "category_name": link.get_text(strip=True),
                "category_url": urljoin(BASE_URL, href),
            }
        )

    return categories


def scrape_category_product_ids(
    session: requests.Session,
    category_id: str,
) -> set[str]:
    ids: set[str] = set()
    url = f"{BASE_URL}/product-category/{category_id}"

    resp = session.get(url, timeout=60)
    resp.raise_for_status()
    last_page = get_last_page(resp.text)

    def collect_from_html(html: str) -> None:
        soup = BeautifulSoup(html, "html.parser")
        for grid in soup.select("div.product-grid4"):
            link = grid.select_one("div.product-image4 a[href]")
            product_url = urljoin(BASE_URL, link["href"]) if link and link.get("href") else None
            product_id = extract_product_id(grid, product_url)
            if product_id:
                ids.add(product_id)

    collect_from_html(resp.text)

    for page in range(2, last_page + 1):
        time.sleep(0.3)
        page_resp = session.get(f"{url}?page={page}", timeout=60)
        page_resp.raise_for_status()
        collect_from_html(page_resp.text)

    return ids


def build_category_map(session: requests.Session) -> dict[str, dict[str, str]]:
    categories = fetch_categories(session)
    print(f"Found {len(categories)} categories")

    category_map: dict[str, dict[str, str]] = {}

    for index, category in enumerate(categories, start=1):
        category_id = category["category_id"]
        category_name = category["category_name"]
        print(f"[{index}/{len(categories)}] Category {category_id}: {category_name}")

        product_ids = scrape_category_product_ids(session, category_id)
        print(f"  -> {len(product_ids)} products")

        for product_id in product_ids:
            if product_id not in category_map:
                category_map[product_id] = {
                    "category_id": category_id,
                    "category_name": category_name,
                    "category_url": category["category_url"],
                }

    return category_map


def apply_categories(products: list[dict], category_map: dict[str, dict[str, str]]) -> None:
    matched = 0
    for product in products:
        info = category_map.get(product.get("id", ""))
        if info:
            product["category_id"] = info["category_id"]
            product["category_name"] = info["category_name"]
            product["category_url"] = info["category_url"]
            matched += 1
        else:
            product["category_id"] = None
            product["category_name"] = None
            product["category_url"] = None

    print(f"Categories matched: {matched}/{len(products)}")


def scrape_all_products(session: requests.Session) -> list[dict]:
    print("Fetching all-products page 1...")
    resp = session.get(ALL_PRODUCTS_URL, timeout=60)
    resp.raise_for_status()

    last_page = get_last_page(resp.text)
    print(f"Found {last_page} product listing pages")

    seen_ids: set[str] = set()
    all_products: list[dict] = []

    def add_page_products(page_products: list[dict], page: int) -> None:
        added = 0
        for product in page_products:
            key = product.get("id") or product.get("name")
            if key in seen_ids:
                continue
            seen_ids.add(key)
            product["page"] = page
            all_products.append(product)
            added += 1
        print(f"  Page {page}: {len(page_products)} cards, {added} new (total {len(all_products)})")

    add_page_products(extract_products(resp.text), 1)

    for page in range(2, last_page + 1):
        time.sleep(0.4)
        print(f"Fetching all-products page {page}...")
        resp = session.get(f"{ALL_PRODUCTS_URL}?page={page}", timeout=60)
        resp.raise_for_status()
        add_page_products(extract_products(resp.text), page)

    return all_products


def save_products(products: list[dict]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = OUTPUT_DIR / "rasanmart-products.json"
    csv_path = OUTPUT_DIR / "rasanmart-products.csv"

    with json_path.open("w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    fieldnames = [
        "id",
        "name",
        "category_id",
        "category_name",
        "category_url",
        "price",
        "original_price",
        "image_url",
        "product_url",
        "in_stock",
        "page",
    ]
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(products)

    missing_images = sum(1 for p in products if not p.get("image_url"))
    missing_categories = sum(1 for p in products if not p.get("category_name"))

    print(f"\nDone: {len(products)} products")
    print(f"Missing images: {missing_images}")
    print(f"Missing categories: {missing_categories}")
    print(f"JSON: {json_path}")
    print(f"CSV:  {csv_path}")


def main() -> None:
    session = requests.Session()
    session.headers.update(HEADERS)

    json_path = OUTPUT_DIR / "rasanmart-products.json"
    if json_path.exists():
        print(f"Loading existing products from {json_path}")
        with json_path.open(encoding="utf-8") as f:
            products = json.load(f)
        print(f"Loaded {len(products)} products")
    else:
        products = scrape_all_products(session)

    category_map = build_category_map(session)
    apply_categories(products, category_map)
    save_products(products)


if __name__ == "__main__":
    main()
