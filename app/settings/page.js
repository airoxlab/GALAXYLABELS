'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  Building2,
  FileText,
  DollarSign,
  Image,
  Save,
  ChevronLeft,
  RefreshCw,
  User,
  Package,
} from 'lucide-react';

// Import settings components
import {
  ImageUploader,
  CompanyInfoSection,
  InvoicePrefixSection,
  CurrencySection,
  AccountSection,
} from '@/components/settings';

// Fallback currencies list (used if database fetch fails)
const FALLBACK_CURRENCIES = [
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs', rate_to_pkr: 1 },
  { code: 'USD', name: 'US Dollar', symbol: '$', rate_to_pkr: 278.50 },
  { code: 'EUR', name: 'Euro', symbol: '€', rate_to_pkr: 302.00 },
  { code: 'GBP', name: 'British Pound', symbol: '£', rate_to_pkr: 352.00 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', rate_to_pkr: 75.85 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', rate_to_pkr: 74.27 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', rate_to_pkr: 3.34 },
];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('company');

  // Form Data
  const [formData, setFormData] = useState({
    company_name: '',
    contact_detail_1: '',
    contact_detail_2: '',
    contact_detail_3: '',
    ntn: '',
    str: '',
    email_1: '',
    email_2: '',
    company_address: '',
    logo_url: '',
    signature_url: '',
    owner_picture_url: '',
    qr_code_url: '',
  });

  // Invoice Prefixes
  const [invoicePrefixes, setInvoicePrefixes] = useState({
    sale_order_prefix: 'SO',
    sale_order_next_number: 1,
    sale_invoice_prefix: 'INV',
    sale_invoice_next_number: 1,
    purchase_order_prefix: 'PO',
    purchase_order_next_number: 1,
    payment_in_prefix: 'PI',
    payment_in_next_number: 1,
    payment_out_prefix: 'PO-PAY',
    payment_out_next_number: 1,
    stock_in_prefix: 'STK-IN',
    stock_in_next_number: 1,
    stock_out_prefix: 'STK-OUT',
    stock_out_next_number: 1,
  });

  // Stock Settings
  const [stockSettings, setStockSettings] = useState({
    restrict_negative_stock: false,
  });

  // Currency Settings
  const [selectedCurrencies, setSelectedCurrencies] = useState([
    { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs', rate_to_pkr: 1 }
  ]);
  const [defaultCurrency, setDefaultCurrency] = useState('PKR');
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [availableCurrencies, setAvailableCurrencies] = useState(FALLBACK_CURRENCIES);

  // Image states
  const [logoPreview, setLogoPreview] = useState('');
  const [signaturePreview, setSignaturePreview] = useState('');
  const [picturePreview, setPicturePreview] = useState('');
  const [qrCodePreview, setQrCodePreview] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [uploadingQrCode, setUploadingQrCode] = useState(false);

  // Account/Profile states
  const [accountData, setAccountData] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
  });
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        await loadCurrenciesFromDatabase();
        await loadUserCurrencies(data.user.id);
        await loadSettings(data.user.id);
        await loadAccountData(data.user.id);
      } else {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  // Load all currencies from public database table (master list for all users)
  const loadCurrenciesFromDatabase = async () => {
    try {
      const { data, error } = await supabase
        .from('currencies')
        .select('code, name, symbol')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      if (data && data.length > 0) {
        setAvailableCurrencies(data);
      }
      // If no data or error, keep using FALLBACK_CURRENCIES
    } catch (error) {
      console.error('Error loading currencies from database:', error);
      // Keep using fallback currencies
    }
  };

  // Load user's selected currencies from user_currencies table
  const loadUserCurrencies = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_currencies')
        .select('code, name, symbol, rate_to_pkr, is_default')
        .eq('user_id', userId)
        .order('code');

      if (error) throw error;

      if (data && data.length > 0) {
        setSelectedCurrencies(data);
        // Set default currency
        const defaultCurr = data.find(c => c.is_default);
        if (defaultCurr) {
          setDefaultCurrency(defaultCurr.code);
        }
      } else {
        // If no currencies, add PKR as default
        await addDefaultPKR(userId);
      }
    } catch (error) {
      console.error('Error loading user currencies:', error);
    }
  };

  // Add default PKR currency for new users
  const addDefaultPKR = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_currencies')
        .insert([{
          user_id: userId,
          code: 'PKR',
          name: 'Pakistani Rupee',
          symbol: 'Rs',
          rate_to_pkr: 1,
          is_default: true
        }])
        .select();

      if (error) throw error;

      if (data) {
        setSelectedCurrencies(data);
        setDefaultCurrency('PKR');
      }
    } catch (error) {
      console.error('Error adding default PKR:', error);
    }
  };

  const loadAccountData = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username, full_name, email, phone')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        setAccountData({
          username: data.username || '',
          full_name: data.full_name || '',
          email: data.email || '',
          phone: data.phone || '',
        });
      }
    } catch (error) {
      console.error('Error loading account data:', error);
    }
  };

  const loadSettings = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setFormData({
          company_name: data.company_name || '',
          contact_detail_1: data.contact_detail_1 || '',
          contact_detail_2: data.contact_detail_2 || '',
          contact_detail_3: data.contact_detail_3 || '',
          ntn: data.ntn || '',
          str: data.str || '',
          email_1: data.email_1 || '',
          email_2: data.email_2 || '',
          company_address: data.company_address || '',
          logo_url: data.logo_url || '',
          signature_url: data.signature_url || '',
          owner_picture_url: data.owner_picture_url || '',
          qr_code_url: data.qr_code_url || '',
        });

        setInvoicePrefixes({
          sale_order_prefix: data.sale_order_prefix || 'SO',
          sale_order_next_number: data.sale_order_next_number || 1,
          sale_invoice_prefix: data.sale_invoice_prefix || 'INV',
          sale_invoice_next_number: data.sale_invoice_next_number || 1,
          purchase_order_prefix: data.purchase_order_prefix || 'PO',
          purchase_order_next_number: data.purchase_order_next_number || 1,
          payment_in_prefix: data.payment_in_prefix || 'PI',
          payment_in_next_number: data.payment_in_next_number || 1,
          payment_out_prefix: data.payment_out_prefix || 'PO-PAY',
          payment_out_next_number: data.payment_out_next_number || 1,
          stock_in_prefix: data.stock_in_prefix || 'STK-IN',
          stock_in_next_number: data.stock_in_next_number || 1,
          stock_out_prefix: data.stock_out_prefix || 'STK-OUT',
          stock_out_next_number: data.stock_out_next_number || 1,
        });

        setStockSettings({
          restrict_negative_stock: data.restrict_negative_stock || false,
        });

        // Note: Currencies are now loaded from user_currencies table, not from settings JSON

        setLogoPreview(data.logo_url || '');
        setSignaturePreview(data.signature_url || '');
        setPicturePreview(data.owner_picture_url || '');
        setQrCodePreview(data.qr_code_url || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Error loading settings', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePrefixChange = (e) => {
    const { name, value } = e.target;
    setInvoicePrefixes((prev) => ({ ...prev, [name]: value }));
  };

  // Image upload and delete functions
  const uploadImageToSupabase = async (file, type) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}_${user.id}_${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const deleteImageFromBucket = async (url, type) => {
    if (!url) return;

    try {
      // Extract file name from URL
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1];

      const { error } = await supabase.storage
        .from('company-assets')
        .remove([fileName]);

      if (error) throw error;

      // Update form data
      const urlField = type === 'owner_picture' ? 'owner_picture_url' : `${type}_url`;
      setFormData(prev => ({ ...prev, [urlField]: '' }));

      // Update preview
      if (type === 'logo') setLogoPreview('');
      if (type === 'signature') setSignaturePreview('');
      if (type === 'owner_picture') setPicturePreview('');
      if (type === 'qr_code') setQrCodePreview('');

      toast.success('Image deleted', {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  const handleImageUpload = async (file, type) => {
    try {
      if (type === 'logo') setUploadingLogo(true);
      if (type === 'signature') setUploadingSignature(true);
      if (type === 'owner_picture') setUploadingPicture(true);
      if (type === 'qr_code') setUploadingQrCode(true);

      // Show preview
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'logo') setLogoPreview(reader.result);
        if (type === 'signature') setSignaturePreview(reader.result);
        if (type === 'owner_picture') setPicturePreview(reader.result);
        if (type === 'qr_code') setQrCodePreview(reader.result);
      };
      reader.readAsDataURL(file);

      const publicUrl = await uploadImageToSupabase(file, type);

      const urlField = type === 'owner_picture' ? 'owner_picture_url' : `${type}_url`;
      setFormData(prev => ({ ...prev, [urlField]: publicUrl }));

      toast.success('Image uploaded', {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      toast.error('Error uploading: ' + error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      if (type === 'signature') setUploadingSignature(false);
      if (type === 'owner_picture') setUploadingPicture(false);
      if (type === 'qr_code') setUploadingQrCode(false);
    }
  };

  // Currency management
  const addCurrency = async () => {
    if (!newCurrencyCode || !user) return;

    const currency = availableCurrencies.find(c => c.code === newCurrencyCode);
    if (!currency) return;

    if (selectedCurrencies.find(c => c.code === newCurrencyCode)) {
      toast.error('Currency already added', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    try {
      // Insert into user_currencies table
      const { data, error } = await supabase
        .from('user_currencies')
        .insert([{
          user_id: user.id,
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol,
          rate_to_pkr: 1,
          is_default: false
        }])
        .select();

      if (error) throw error;

      if (data) {
        setSelectedCurrencies(prev => [...prev, data[0]]);
        setNewCurrencyCode('');
        toast.success('Currency added', {
          duration: 1000,
          style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
        });
      }
    } catch (error) {
      console.error('Error adding currency:', error);
      toast.error('Failed to add currency', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  const removeCurrency = async (code) => {
    if (!user) return;

    if (code === 'PKR') {
      toast.error('PKR cannot be removed', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('user_currencies')
        .delete()
        .eq('user_id', user.id)
        .eq('code', code);

      if (error) throw error;

      setSelectedCurrencies(prev => prev.filter(c => c.code !== code));

      // If removed currency was default, set PKR as default
      if (defaultCurrency === code) {
        await setDefaultCurrencyInDB('PKR');
      }

      toast.success('Currency removed', {
        duration: 1000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      console.error('Error removing currency:', error);
      toast.error('Failed to remove currency', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  const updateCurrencyRate = async (code, rate) => {
    if (!user) return;

    const newRate = parseFloat(rate) || 0;

    // Update local state immediately for responsiveness
    setSelectedCurrencies(prev =>
      prev.map(c => c.code === code ? { ...c, rate_to_pkr: newRate } : c)
    );

    try {
      const { error } = await supabase
        .from('user_currencies')
        .update({ rate_to_pkr: newRate })
        .eq('user_id', user.id)
        .eq('code', code);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating currency rate:', error);
    }
  };

  // Set default currency in database
  const setDefaultCurrencyInDB = async (code) => {
    if (!user) return;

    try {
      // First, set all currencies as non-default
      await supabase
        .from('user_currencies')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Then set the selected one as default
      const { error } = await supabase
        .from('user_currencies')
        .update({ is_default: true })
        .eq('user_id', user.id)
        .eq('code', code);

      if (error) throw error;

      setDefaultCurrency(code);

      // Update local state
      setSelectedCurrencies(prev =>
        prev.map(c => ({ ...c, is_default: c.code === code }))
      );
    } catch (error) {
      console.error('Error setting default currency:', error);
      toast.error('Failed to set default currency', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    }
  };

  // Save settings
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    try {
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const settingsData = {
        user_id: user.id,
        ...formData,
        ...invoicePrefixes,
        ...stockSettings,
        // Note: Currencies are now saved in user_currencies table, not in settings
      };

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update(settingsData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert([settingsData]);

        if (error) throw error;
      }

      // Clear cached company settings so sidebar will refresh
      localStorage.removeItem('companySettings');

      toast.success('Settings saved successfully', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save: ' + error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setSaving(false);
    }
  };

  // Save account data
  const handleSaveAccount = async () => {
    if (!user) return;
    setSavingAccount(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          username: accountData.username,
          full_name: accountData.full_name,
          email: accountData.email,
          phone: accountData.phone,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Account updated successfully', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } catch (error) {
      console.error('Error updating account:', error);
      toast.error('Failed to update: ' + error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setSavingAccount(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (!user) return;

    if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) {
      toast.error('Please fill all password fields', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    if (passwordData.new_password.length < 6) {
      toast.error('Password must be at least 6 characters', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
      return;
    }

    setSavingPassword(true);

    try {
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      if (userData.password_hash !== passwordData.current_password) {
        throw new Error('Current password is incorrect');
      }

      const { error } = await supabase
        .from('users')
        .update({ password_hash: passwordData.new_password })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Password changed successfully', {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });

      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error.message, {
        duration: 2000,
        style: { background: '#171717', color: '#fff', borderRadius: '12px', fontSize: '14px' }
      });
    } finally {
      setSavingPassword(false);
    }
  };

  // Sidebar navigation items
  const sidebarItems = [
    { id: 'company', label: 'Company Info', icon: Building2 },
    { id: 'invoices', label: 'Invoice Numbers', icon: FileText },
    { id: 'currency', label: 'Currency', icon: DollarSign },
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'images', label: 'Images', icon: Image },
    { id: 'account', label: 'Account', icon: User },
  ];

  // Currency dropdown options
  const currencyOptions = availableCurrencies
    .filter(c => !selectedCurrencies.find(sc => sc.code === c.code))
    .map(c => ({ value: c.code, label: `${c.code} - ${c.name}` }));

  if (loading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className={cn(
              "p-2 rounded-lg",
              "hover:bg-neutral-100",
              "transition-all duration-200"
            )}
          >
            <ChevronLeft className="w-4 h-4 text-neutral-600" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-neutral-900 tracking-tight">Settings</h1>
            <p className="text-xs text-neutral-500">Manage your company settings and preferences</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 140px)' }}>
            {/* Sidebar */}
            <div className={cn(
              "w-48 flex-shrink-0 sticky top-4 self-start",
              "bg-white/80 backdrop-blur-xl rounded-xl",
              "border border-neutral-200/60",
              "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
              "p-2"
            )}>
              <nav className="space-y-1">
                {sidebarItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg",
                      "text-xs font-medium",
                      "transition-all duration-200",
                      activeSection === item.id
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-600 hover:bg-neutral-100"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
              </nav>

              {/* Save Button in Sidebar */}
              <div className="mt-4 pt-4 border-t border-neutral-200/60">
                <button
                  type="submit"
                  disabled={saving}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg",
                    "bg-neutral-900 text-white",
                    "text-xs font-medium",
                    "hover:bg-neutral-800",
                    "transition-all duration-200",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-2"
                  )}
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className={cn(
              "flex-1",
              "bg-white/80 backdrop-blur-xl rounded-xl",
              "border border-neutral-200/60",
              "shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
              "p-4"
            )}>
              {/* Company Information Section */}
              {activeSection === 'company' && (
                <CompanyInfoSection formData={formData} onChange={handleChange} />
              )}

              {/* Invoice Numbers Section */}
              {activeSection === 'invoices' && (
                <InvoicePrefixSection invoicePrefixes={invoicePrefixes} onChange={handlePrefixChange} />
              )}

              {/* Currency Section */}
              {activeSection === 'currency' && (
                <CurrencySection
                  selectedCurrencies={selectedCurrencies}
                  defaultCurrency={defaultCurrency}
                  newCurrencyCode={newCurrencyCode}
                  currencyOptions={currencyOptions}
                  onAddCurrency={addCurrency}
                  onRemoveCurrency={removeCurrency}
                  onUpdateRate={updateCurrencyRate}
                  onSetDefault={setDefaultCurrencyInDB}
                  onNewCurrencyChange={setNewCurrencyCode}
                />
              )}

              {/* Stock Section */}
              {activeSection === 'stock' && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-neutral-900">Stock Management Settings</h2>

                  <div className={cn(
                    "p-4 rounded-lg",
                    "bg-neutral-50/80 border border-neutral-200/60"
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-medium text-neutral-900">Restrict Negative Stock</h3>
                        <p className="text-[10px] text-neutral-500 mt-1">
                          When enabled, prevents stock out transactions if the product has insufficient stock
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={stockSettings.restrict_negative_stock}
                          onChange={(e) => setStockSettings(prev => ({
                            ...prev,
                            restrict_negative_stock: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className={cn(
                          "w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer",
                          "peer-checked:after:translate-x-full peer-checked:after:border-white",
                          "after:content-[''] after:absolute after:top-[2px] after:left-[2px]",
                          "after:bg-white after:border-neutral-300 after:border after:rounded-full",
                          "after:h-4 after:w-4 after:transition-all",
                          "peer-checked:bg-neutral-900"
                        )}></div>
                      </label>
                    </div>
                  </div>

                  <div className={cn(
                    "p-4 rounded-lg",
                    "bg-blue-50/80 border border-blue-200/60"
                  )}>
                    <h3 className="text-xs font-medium text-blue-900">Auto Stock Updates</h3>
                    <p className="text-[10px] text-blue-700 mt-1">
                      Stock is automatically updated when purchase orders and sale orders are created:
                    </p>
                    <ul className="text-[10px] text-blue-700 mt-2 space-y-1 list-disc list-inside">
                      <li>Purchase orders automatically add stock (Stock In)</li>
                      <li>Sale orders/invoices automatically deduct stock (Stock Out)</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Images Section */}
              {activeSection === 'images' && (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-neutral-900">Company Images</h2>

                  <div className="grid grid-cols-2 gap-4">
                    <ImageUploader
                      label="Logo"
                      preview={logoPreview}
                      uploading={uploadingLogo}
                      onUpload={(file) => handleImageUpload(file, 'logo')}
                      onDelete={() => deleteImageFromBucket(formData.logo_url, 'logo')}
                    />

                    <ImageUploader
                      label="Signature"
                      preview={signaturePreview}
                      uploading={uploadingSignature}
                      onUpload={(file) => handleImageUpload(file, 'signature')}
                      onDelete={() => deleteImageFromBucket(formData.signature_url, 'signature')}
                    />

                    <ImageUploader
                      label="Owner Picture"
                      preview={picturePreview}
                      uploading={uploadingPicture}
                      onUpload={(file) => handleImageUpload(file, 'owner_picture')}
                      onDelete={() => deleteImageFromBucket(formData.owner_picture_url, 'owner_picture')}
                      rounded
                    />

                    <ImageUploader
                      label="QR Code"
                      preview={qrCodePreview}
                      uploading={uploadingQrCode}
                      onUpload={(file) => handleImageUpload(file, 'qr_code')}
                      onDelete={() => deleteImageFromBucket(formData.qr_code_url, 'qr_code')}
                    />
                  </div>

                  <p className="text-[10px] text-neutral-500">
                    Maximum file size: 2MB. Supported formats: JPG, PNG, GIF
                  </p>
                </div>
              )}

              {/* Account Section */}
              {activeSection === 'account' && (
                <AccountSection
                  accountData={accountData}
                  passwordData={passwordData}
                  showCurrentPassword={showCurrentPassword}
                  showNewPassword={showNewPassword}
                  showConfirmPassword={showConfirmPassword}
                  savingAccount={savingAccount}
                  savingPassword={savingPassword}
                  onAccountChange={(field, value) => setAccountData(prev => ({ ...prev, [field]: value }))}
                  onPasswordChange={(field, value) => setPasswordData(prev => ({ ...prev, [field]: value }))}
                  onSaveAccount={handleSaveAccount}
                  onChangePassword={handleChangePassword}
                  onToggleCurrentPassword={() => setShowCurrentPassword(!showCurrentPassword)}
                  onToggleNewPassword={() => setShowNewPassword(!showNewPassword)}
                  onToggleConfirmPassword={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              )}
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
