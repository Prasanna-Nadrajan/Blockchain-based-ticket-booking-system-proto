import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { connectWallet, checkConnection, getContract, loadDeployment } from '../utils/web3';
import { ethers } from 'ethers';
import api from '../utils/api';

export default function CreateEvent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    coverImageUrl: '',
    startDate: '',
    startTimeValue: '18:00',
    endDate: '',
    endTimeValue: '21:00',
    timezone: 'Asia/Kolkata',
    locationType: 'offline',
    venue: '',
    city: 'Chennai',
    country: 'India',
    virtualUrl: '',
    visibility: 'public',
    requireApproval: false,
    isFree: true,
    priceEth: 0.01,
    capacity: 100,
    tags: [],
  });

  const [tagInput, setTagInput] = useState('');

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag] });
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.startDate) {
      showToast('Error', 'Event name and date are required', true);
      return;
    }

    setLoading(true);
    try {
      const startTime = new Date(`${form.startDate}T${form.startTimeValue}`);
      const endTime = form.endDate ? new Date(`${form.endDate}T${form.endTimeValue}`) : undefined;

      const { data: event } = await api.post('/events', {
        name: form.name,
        description: form.description,
        coverImageUrl: form.coverImageUrl,
        startTime: startTime.toISOString(),
        endTime: endTime?.toISOString(),
        date: form.startDate,
        timezone: form.timezone,
        locationType: form.locationType,
        location: {
          address: form.venue,
          city: form.city,
          country: form.country,
          virtualUrl: form.virtualUrl,
        },
        venue: form.venue,
        visibility: form.visibility,
        requireApproval: form.requireApproval,
        isFree: form.isFree,
        capacity: form.capacity,
        price_eth: form.isFree ? 0 : form.priceEth,
        tags: form.tags,
      });

      // Try registering on blockchain
      try {
        await loadDeployment();
        const addr = await checkConnection();
        if (addr) {
          const contract = getContract();
          if (contract && !form.isFree) {
            const priceWei = ethers.parseEther(form.priceEth.toString());
            const tx = await contract.setEventParams(event.id, priceWei, form.capacity);
            await tx.wait();
          }
        }
      } catch (chainErr) {
        console.warn('Blockchain registration skipped:', chainErr.message);
      }

      showToast('Success', 'Event created! 🎉');
      navigate(`/events/${event.id}`);
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to create event', true);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] outline-none transition-all focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-accent)]/10 placeholder:text-[var(--color-text-tertiary)]";
  const labelClass = "block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Create Event</h1>
        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Fill in the details for your new event</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cover Image */}
        <div>
          <label className={labelClass}>Cover Image URL</label>
          <div className="relative">
            {form.coverImageUrl ? (
              <div className="aspect-[21/9] rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] mb-2">
                <img src={form.coverImageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-[21/9] rounded-xl border-2 border-dashed border-[var(--color-border)] flex items-center justify-center bg-[var(--color-bg)] mb-2 cursor-pointer hover:border-[var(--color-border-hover)] transition-colors">
                <div className="text-center">
                  <span className="text-3xl block mb-2">📷</span>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Paste a cover image URL below
                  </p>
                </div>
              </div>
            )}
            <input
              type="url"
              value={form.coverImageUrl}
              onChange={(e) => handleChange('coverImageUrl', e.target.value)}
              placeholder="https://example.com/image.jpg"
              className={inputClass}
            />
          </div>
        </div>

        {/* Event Name */}
        <div>
          <label className={labelClass}>Event Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            placeholder="e.g. Web3 Builders Meetup"
            className="w-full bg-transparent border-0 border-b-2 border-[var(--color-border)] py-3 text-xl font-semibold text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-tertiary)] placeholder:font-normal"
          />
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Start Date *</label>
            <input type="date" value={form.startDate} onChange={(e) => handleChange('startDate', e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Start Time</label>
            <input type="time" value={form.startTimeValue} onChange={(e) => handleChange('startTimeValue', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>End Date</label>
            <input type="date" value={form.endDate} onChange={(e) => handleChange('endDate', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>End Time</label>
            <input type="time" value={form.endTimeValue} onChange={(e) => handleChange('endTimeValue', e.target.value)} className={inputClass} />
          </div>
        </div>

        {/* Timezone */}
        <div>
          <label className={labelClass}>Timezone</label>
          <select value={form.timezone} onChange={(e) => handleChange('timezone', e.target.value)} className={inputClass}>
            <option value="Asia/Kolkata">GMT+05:30 — Asia/Kolkata</option>
            <option value="America/New_York">GMT-05:00 — America/New_York</option>
            <option value="America/Los_Angeles">GMT-08:00 — America/Los_Angeles</option>
            <option value="Europe/London">GMT+00:00 — Europe/London</option>
            <option value="Asia/Tokyo">GMT+09:00 — Asia/Tokyo</option>
            <option value="Australia/Sydney">GMT+11:00 — Australia/Sydney</option>
          </select>
        </div>

        {/* Location Type */}
        <div>
          <label className={labelClass}>Location</label>
          <div className="flex gap-2 mb-3">
            {['offline', 'virtual', 'hybrid'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleChange('locationType', type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all cursor-pointer border ${
                  form.locationType === type
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] border-[var(--color-accent)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
                }`}
              >
                {type === 'offline' ? '📍 In Person' : type === 'virtual' ? '💻 Virtual' : '🔄 Hybrid'}
              </button>
            ))}
          </div>

          {(form.locationType === 'offline' || form.locationType === 'hybrid') && (
            <div className="space-y-3">
              <input type="text" value={form.venue} onChange={(e) => handleChange('venue', e.target.value)} placeholder="Venue address" className={inputClass} />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={form.city} onChange={(e) => handleChange('city', e.target.value)} placeholder="City" className={inputClass} />
                <input type="text" value={form.country} onChange={(e) => handleChange('country', e.target.value)} placeholder="Country" className={inputClass} />
              </div>
            </div>
          )}

          {(form.locationType === 'virtual' || form.locationType === 'hybrid') && (
            <input type="url" value={form.virtualUrl} onChange={(e) => handleChange('virtualUrl', e.target.value)} placeholder="Virtual meeting URL" className={`${inputClass} mt-3`} />
          )}
        </div>

        {/* Event Options */}
        <div className="luma-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Event Options</h3>

          {/* Visibility */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Public Event</p>
              <p className="text-xs text-[var(--color-text-tertiary)]">Anyone can discover this event</p>
            </div>
            <button
              type="button"
              onClick={() => handleChange('visibility', form.visibility === 'public' ? 'private' : 'public')}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer border-0 ${
                form.visibility === 'public' ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
              }`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                form.visibility === 'public' ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Require Approval */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Require Approval</p>
              <p className="text-xs text-[var(--color-text-tertiary)]">Manually approve each registration</p>
            </div>
            <button
              type="button"
              onClick={() => handleChange('requireApproval', !form.requireApproval)}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer border-0 ${
                form.requireApproval ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
              }`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                form.requireApproval ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Capacity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Capacity</p>
            </div>
            <input
              type="number"
              value={form.capacity}
              onChange={(e) => handleChange('capacity', parseInt(e.target.value) || 1)}
              min="1"
              className={inputClass}
            />
          </div>

          {/* Pricing */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Ticket Price</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">Free or paid with ETH</p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleChange('isFree', true)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                    form.isFree
                      ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] border-[var(--color-accent)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
                  }`}
                >
                  Free
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('isFree', false)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer border ${
                    !form.isFree
                      ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] border-[var(--color-accent)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
                  }`}
                >
                  Paid
                </button>
              </div>
            </div>
            {!form.isFree && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  value={form.priceEth}
                  onChange={(e) => handleChange('priceEth', parseFloat(e.target.value) || 0)}
                  step="0.001"
                  min="0"
                  className={inputClass}
                />
                <span className="text-sm font-medium text-[var(--color-text-secondary)] whitespace-nowrap">ETH</span>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className={labelClass}>Tags / Categories</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {form.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--color-accent-soft)] rounded-full text-xs font-medium text-[var(--color-text-secondary)]">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] cursor-pointer bg-transparent border-0 text-xs">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Add tag (e.g. tech, ai)"
              className={inputClass}
            />
            <button type="button" onClick={addTag} className="px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer bg-[var(--color-surface)]">
              Add
            </button>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Tell people about your event..."
            rows={5}
            className={`${inputClass} resize-none`}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold py-3 rounded-xl text-sm hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create Event'}
        </button>
      </form>
    </div>
  );
}
