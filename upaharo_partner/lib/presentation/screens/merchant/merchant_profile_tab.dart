import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';

class MerchantProfileTab extends StatefulWidget {
  const MerchantProfileTab({super.key});

  @override
  State<MerchantProfileTab> createState() => _MerchantProfileTabState();
}

class _MerchantProfileTabState extends State<MerchantProfileTab> {
  late final TextEditingController _name;
  late final TextEditingController _address;
  late final TextEditingController _phone;
  late final TextEditingController _bankName;
  late final TextEditingController _bankNo;
  late final TextEditingController _ifsc;
  late final TextEditingController _pan;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final s = context.read<AuthProvider>().seller;
    final u = context.read<AuthProvider>().user;
    _name = TextEditingController(text: s?.businessName ?? '');
    _address = TextEditingController(text: s?.businessAddress ?? '');
    _phone = TextEditingController(text: s?.phone ?? u?.phone ?? '');
    _bankName = TextEditingController(text: s?.bankAccountName ?? '');
    _bankNo = TextEditingController(text: s?.bankAccountNo ?? '');
    _ifsc = TextEditingController(text: s?.ifscCode ?? '');
    _pan = TextEditingController(text: s?.panNumber ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _address.dispose();
    _phone.dispose();
    _bankName.dispose();
    _bankNo.dispose();
    _ifsc.dispose();
    _pan.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await context.read<AuthProvider>().updateProfile({
        'name': context.read<AuthProvider>().user?.name,
        'seller': {
          'businessName': _name.text.trim(),
          'businessAddress': _address.text.trim(),
          'phone': _phone.text.trim(),
          'bankAccountName': _bankName.text.trim(),
          'bankAccountNo': _bankNo.text.trim(),
          'ifscCode': _ifsc.text.trim(),
          'panNumber': _pan.text.trim(),
        },
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Shop profile saved')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(DioClient.errorMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final primary = AppTheme.primary(auth.storeSlug);
    final verified = auth.seller?.isVerified == true;

    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 24),
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE8E8EA)),
          ),
          child: Row(
            children: [
              StatusChip(
                label: verified ? 'Verified' : 'Pending verification',
                color: verified ? primary : AppTheme.warning,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  verified
                      ? '${auth.seller!.commission.toStringAsFixed(0)}% commission'
                      : 'You can view orders while pending',
                  style: const TextStyle(fontSize: 11, color: AppTheme.muted),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        _section(
          'Shop',
          [
            TextField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Business name'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _address,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Pickup address',
                hintText: 'Riders use this location',
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Shop phone'),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _section(
          'Payout',
          [
            TextField(
              controller: _bankName,
              decoration: const InputDecoration(labelText: 'Account holder'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _bankNo,
              decoration: const InputDecoration(labelText: 'Account number'),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _ifsc,
                    decoration: const InputDecoration(labelText: 'IFSC / bank'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _pan,
                    decoration: const InputDecoration(labelText: 'PAN'),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 12),
        ElevatedButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Save'),
        ),
      ],
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppTheme.muted,
                letterSpacing: 0.3,
              ),
            ),
            const SizedBox(height: 8),
            ...children,
          ],
        ),
      ),
    );
  }
}
