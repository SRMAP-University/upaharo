type UploadImageResponse = {
  url: string
  filename: string
  size: number
  type: string
}

export async function uploadProductImage(file: File): Promise<string> {
  return uploadImageToFolder(file, 'products')
}

export async function uploadCategoryImage(file: File): Promise<string> {
  return uploadImageToFolder(file, 'categories')
}

async function uploadImageToFolder(file: File, folder: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)

  const response = await fetch('/api/uploads', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })

  let payload: UploadImageResponse | { error?: string } | null = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error('Image is too large for the server (max ~5MB). Try a smaller file.')
    }
    if (response.status === 401) {
      throw new Error('Session expired — refresh and sign in again as admin.')
    }
    const message =
      payload && 'error' in payload && payload.error
        ? payload.error
        : `Failed to upload image (${response.status})`
    throw new Error(message)
  }

  if (!payload || !('url' in payload) || !payload.url) {
    throw new Error('Upload response was missing image URL')
  }

  return payload.url
}
