import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Award } from 'lucide-react';

const UserForm = ({ onGenerate, isGenerated }) => {
  const [formData, setFormData] = useState({ email: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Multi-group state
  const [multiGroupUsers, setMultiGroupUsers] = useState(null); // array of { user, groupName }

  const validate = () => {
    const newErrors = {};
    if (!formData.email.trim()) newErrors.email = 'Required';
    if (!formData.phone.trim()) newErrors.phone = 'Required';
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    setAuthError('');
  };

  // Once we have a user (single or chosen from list), fetch their group's template
  const loadCertificate = async (user) => {
    setIsLoading(true);
    setAuthError('');
    try {
      if (!user.is_eligible) {
        throw new Error('You are not eligible to receive a certificate.');
      }

      if (!user.group_id) {
        setAuthError('Certificate not ready yet. Please contact the administrator.');
        return;
      }

      // Fetch the template linked to this user's group
      const { data: template } = await supabase
        .from('templates')
        .select('*')
        .eq('group_id', user.group_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!template) {
        setAuthError('Certificate not ready yet. The admin has not created a template for your group yet.');
        return;
      }

      onGenerate({ user, template });
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    setAuthError('');
    setMultiGroupUsers(null);

    try {
      // Fetch ALL rows for this email+phone across all groups
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('*, groups(name)')
        .eq('email', formData.email)
        .eq('phone', formData.phone);

      if (userError) throw userError;

      if (!users || users.length === 0) {
        throw new Error('No user found with those credentials. Please check your email and phone number.');
      }

      if (users.length === 1) {
        // Single match — go directly
        await loadCertificate(users[0]);
      } else {
        // Multiple groups — show selection screen
        setIsLoading(false);
        setMultiGroupUsers(users);
      }
    } catch (err) {
      setAuthError(err.message);
      setIsLoading(false);
    }
  };

  // ── Multi-group selection screen ──
  if (multiGroupUsers) {
    return (
      <div className="glass-panel p-5 sm:p-8 lg:p-10 rounded-2xl shadow-[20px_0_40px_rgba(124,77,255,0.08)]">
        <div className="mb-6">
          <span className="font-label uppercase tracking-[0.3em] text-[10px] text-primary mb-2 block">Multiple Certificates Found</span>
          <h2 className="font-headline text-2xl text-on-surface mb-2">Which Certificate?</h2>
          <p className="text-on-surface-variant text-sm">You are eligible for multiple certificates. Please select one.</p>
        </div>
        <div className="space-y-3">
          {multiGroupUsers.map((user, i) => (
            <button
              key={i}
              onClick={() => { setMultiGroupUsers(null); loadCertificate(user); }}
              className="w-full flex items-center gap-4 p-4 bg-surface-container rounded-xl border border-white/10 hover:border-primary hover:bg-primary/5 transition-all text-left group"
            >
              <Award size={24} className="text-primary flex-shrink-0 group-hover:scale-110 transition-transform" />
              <div>
                <p className="font-medium text-on-surface">{user.groups?.name || 'Certificate'}</p>
                <p className="text-xs text-on-surface-variant">Certificate ID: {user.certificate_id}</p>
              </div>
            </button>
          ))}
          <button onClick={() => setMultiGroupUsers(null)} className="w-full text-center text-sm text-on-surface-variant hover:text-on-surface py-2 transition-colors">
            ← Back
          </button>
        </div>
        {authError && <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">{authError}</div>}
      </div>
    );
  }

  // ── Main form ──
  return (
    <div className="glass-panel p-5 sm:p-8 lg:p-10 rounded-2xl shadow-[20px_0_40px_rgba(124,77,255,0.08)]">
      <div className="mb-6 sm:mb-10">
        <span className="font-label uppercase tracking-[0.3em] text-[10px] text-primary mb-2 block">Verification Portal</span>
        <h1 className="font-headline text-3xl sm:text-4xl text-on-surface leading-tight">Access Your <br/><span className="italic text-secondary">Certificate</span></h1>
        <p className="text-on-surface-variant text-sm mt-2">Enter your registered email and phone number to verify eligibility.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {authError && (
          <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
            {authError}
          </div>
        )}

        <div className="group">
          <div className="flex items-center justify-between mb-2">
            <label className="font-label uppercase tracking-widest text-[10px] text-on-surface-variant flex gap-2">
              Email Address
              {errors.email && <span className="text-error">{errors.email}</span>}
            </label>
            <span className="material-symbols-outlined text-primary text-sm">mail</span>
          </div>
          <input 
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="e.g. artisan@atelier.com"
            className={`w-full bg-surface-container-highest/40 border rounded-lg px-4 py-3.5 text-on-surface placeholder:text-outline-variant focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all ${errors.email ? 'border-error' : 'border-outline-variant/30'}`}
          />
        </div>

        <div className="group">
          <div className="flex items-center justify-between mb-2">
            <label className="font-label uppercase tracking-widest text-[10px] text-on-surface-variant flex gap-2">
              Phone Number
              {errors.phone && <span className="text-error">{errors.phone}</span>}
            </label>
            <span className="material-symbols-outlined text-primary text-sm">call</span>
          </div>
          <input 
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            placeholder="e.g. +1234567890"
            className={`w-full bg-surface-container-highest/40 border rounded-lg px-4 py-3.5 text-on-surface placeholder:text-outline-variant focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all ${errors.phone ? 'border-error' : 'border-outline-variant/30'}`}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={isLoading}
          className="w-full primary-gradient-btn mt-8 text-on-primary-fixed py-4 rounded-lg font-label uppercase tracking-widest text-xs font-bold hover:shadow-[0_0_20px_rgba(205,189,255,0.4)] transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {isLoading ? 'Verifying...' : isGenerated ? 'View Certificate Again' : 'View Certificate'}
        </button>
      </form>
    </div>
  );
};

export default UserForm;

