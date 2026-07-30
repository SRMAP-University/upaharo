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

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: primary.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Icon(
                auth.seller?.isVerified == true
                    ? Icons.verified
                    : Icons.hourglass_top,
                color: primary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  auth.seller?.isVerified == true
                      ? 'Verified seller · ${auth.seller!.commission.toStringAsFixed(0)}% commission'
                      : 'Pending verification — you can still view orders',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Shop details',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _name,
          decoration: const InputDecoration(labelText: 'Business name'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _address,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Shop / pickup location',
            hintText: 'Full address customers / riders should use',
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(labelText: 'Shop phone'),
        ),
        const SizedBox(height: 20),
        const Text(
          'Payout details',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _bankName,
          decoration: const InputDecoration(labelText: 'Account holder name'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _bankNo,
          decoration: const InputDecoration(labelText: 'Account number'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _ifsc,
          decoration: const InputDecoration(labelText: 'Bank / IFSC / branch'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _pan,
          decoration: const InputDecoration(labelText: 'PAN / tax ID'),
        ),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  height: 22,
                  width: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Save shop profile'),
        ),
      ],
    );
  }
}
