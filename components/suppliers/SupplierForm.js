'use client';

import { useState, useEffect } from 'react';

export default function SupplierForm({ supplier, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    supplier_name: '',
    contact_person: '',
    mobile_no: '',
    whatsapp_no: '',
    email: '',
    address: '',
    ntn: '',
    str: '',
    opening_balance: 0,
    notes: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (supplier) {
      setFormData({
        supplier_name: supplier.supplier_name || '',
        contact_person: supplier.contact_person || '',
        mobile_no: supplier.mobile_no || '',
        whatsapp_no: supplier.whatsapp_no || '',
        email: supplier.email || '',
        address: supplier.address || '',
        ntn: supplier.ntn || '',
        str: supplier.str || '',
        opening_balance: supplier.current_balance || 0,
        notes: supplier.notes || '',
      });
    } else {
      setFormData({
        supplier_name: '',
        contact_person: '',
        mobile_no: '',
        whatsapp_no: '',
        email: '',
        address: '',
        ntn: '',
        str: '',
        opening_balance: 0,
        notes: '',
      });
    }
  }, [supplier]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.supplier_name.trim()) {
      newErrors.supplier_name = 'Supplier name is required';
    }

    if (!formData.mobile_no.trim()) {
      newErrors.mobile_no = 'Mobile number is required';
    }

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  return (
    <div>
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Information */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-neutral-500 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Basic Information
          </h3>

          {/* Supplier Name */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="supplier_name"
              value={formData.supplier_name}
              onChange={handleChange}
              placeholder="Enter supplier/company name"
              className={`w-full px-3 py-2.5 bg-neutral-50/80 border rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200 ${
                errors.supplier_name ? 'border-red-500' : 'border-neutral-200/60'
              }`}
            />
            {errors.supplier_name && <p className="text-red-500 text-xs mt-1">{errors.supplier_name}</p>}
          </div>

          {/* Contact Person */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Contact Person
            </label>
            <input
              type="text"
              name="contact_person"
              value={formData.contact_person}
              onChange={handleChange}
              placeholder="Enter contact person name"
              className="w-full px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200"
            />
          </div>

          {/* Mobile & WhatsApp */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="mobile_no"
                value={formData.mobile_no}
                onChange={handleChange}
                placeholder="03XX-XXXXXXX"
                className={`w-full px-3 py-2.5 bg-neutral-50/80 border rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200 ${
                  errors.mobile_no ? 'border-red-500' : 'border-neutral-200/60'
                }`}
              />
              {errors.mobile_no && <p className="text-red-500 text-xs mt-1">{errors.mobile_no}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                WhatsApp Number
              </label>
              <input
                type="text"
                name="whatsapp_no"
                value={formData.whatsapp_no}
                onChange={handleChange}
                placeholder="03XX-XXXXXXX"
                className="w-full px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="supplier@example.com"
              className={`w-full px-3 py-2.5 bg-neutral-50/80 border rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200 ${
                errors.email ? 'border-red-500' : 'border-neutral-200/60'
              }`}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Address
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter complete address"
              rows={3}
              className="w-full px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200 resize-none"
            />
          </div>
        </div>

        {/* Business Information */}
        <div className="space-y-3 pt-3 border-t border-neutral-200/60">
          <h3 className="text-xs font-medium text-neutral-500 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Business Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                NTN Number
              </label>
              <input
                type="text"
                name="ntn"
                value={formData.ntn}
                onChange={handleChange}
                placeholder="Enter NTN"
                className="w-full px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                STR Number
              </label>
              <input
                type="text"
                name="str"
                value={formData.str}
                onChange={handleChange}
                placeholder="Enter STR"
                className="w-full px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200"
              />
            </div>
          </div>

          {!supplier && (
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Opening Balance
              </label>
              <input
                type="number"
                name="opening_balance"
                value={formData.opening_balance}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                className="w-full px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200"
              />
              <p className="text-xs text-neutral-400 mt-1">
                Positive for payable (we owe), negative for receivable (supplier owes)
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes or comments"
              rows={3}
              className="w-full px-3 py-2.5 bg-neutral-50/80 border border-neutral-200/60 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all duration-200 resize-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-3 border-t border-neutral-200/60">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-white border border-neutral-200/60 text-neutral-700 rounded-xl font-medium text-sm hover:bg-neutral-50 hover:border-neutral-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-neutral-900 text-white rounded-xl font-medium text-sm shadow-lg shadow-neutral-900/20 hover:bg-neutral-800 hover:-translate-y-[1px] hover:shadow-xl active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {supplier ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Update Supplier
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Supplier
                  </>
                )}
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
