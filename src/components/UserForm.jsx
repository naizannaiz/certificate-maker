import { useState } from 'react';

const UserForm = ({ onGenerate, isGenerated }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    courseName: '',
    organizationName: '',
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Required';
    if (!formData.mobile.trim()) newErrors.mobile = 'Required';
    if (!formData.email.trim()) newErrors.email = 'Required';
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onGenerate(formData);
  };

  const formFields = [
    {
      label: 'Recipient Full Name',
      name: 'fullName',
      type: 'text',
      placeholder: 'e.g. Julian Vane',
      icon: 'person'
    },
    {
      label: 'Mobile Number',
      name: 'mobile',
      type: 'tel',
      placeholder: '+1 (555) 000-0000',
      icon: 'call'
    },
    {
      label: 'Email Address',
      name: 'email',
      type: 'email',
      placeholder: 'artisan@atelier.com',
      icon: 'mail'
    },
    {
      label: 'Course / Program (Optional)',
      name: 'courseName',
      type: 'text',
      placeholder: 'e.g. Mastery of Digital Craftsmanship',
      icon: 'school'
    },
    {
      label: 'Organization (Optional)',
      name: 'organizationName',
      type: 'text',
      placeholder: 'e.g. The Sovereign Atelier',
      icon: 'corporate_fare'
    }
  ];

  return (
    <div className="glass-panel p-5 sm:p-8 lg:p-10 rounded-2xl shadow-[20px_0_40px_rgba(124,77,255,0.08)]">
      <div className="mb-6 sm:mb-10">
        <span className="font-label uppercase tracking-[0.3em] text-[10px] text-primary mb-2 block">Creation Suite</span>
        <h1 className="font-headline text-3xl sm:text-4xl text-on-surface leading-tight">Create Your <br/><span className="italic text-secondary">Certificate</span></h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {formFields.map((field) => (
          <div className="group" key={field.name}>
            <div className="flex items-center justify-between mb-2">
              <label className="font-label uppercase tracking-widest text-[10px] text-on-surface-variant flex gap-2">
                {field.label}
                {errors[field.name] && <span className="text-error">{errors[field.name]}</span>}
              </label>
              <span className="material-symbols-outlined text-primary text-sm">{field.icon}</span>
            </div>
            <input 
              name={field.name}
              type={field.type}
              value={formData[field.name]}
              onChange={handleChange}
              placeholder={field.placeholder}
              className={`w-full bg-surface-container-highest/40 border rounded-lg px-4 py-3.5 text-on-surface placeholder:text-outline-variant focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all ${errors[field.name] ? 'border-error' : 'border-outline-variant/30'}`}
            />
          </div>
        ))}
        
        <button 
          type="submit" 
          className="w-full primary-gradient-btn mt-8 text-on-primary-fixed py-4 rounded-lg font-label uppercase tracking-widest text-xs font-bold hover:shadow-[0_0_20px_rgba(205,189,255,0.4)] transition-all active:scale-[0.98]"
        >
          {isGenerated ? 'Regenerate Certificate' : 'Generate Certificate'}
        </button>
      </form>
    </div>
  );
};

export default UserForm;
