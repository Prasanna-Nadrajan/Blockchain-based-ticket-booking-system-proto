import React, { useState } from 'react';

export default function EventCreationForm() {
  const [formData, setFormData] = useState({
    name: '', type: 'offline', public: true, requireApproval: false, capacity: 100
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-inter py-12 px-4 selection:bg-slate-200">
      <div className="max-w-2xl mx-auto backdrop-blur-lg bg-white/70 border border-slate-200 p-8 rounded-2xl shadow-sm">
        <h1 className="text-2xl font-semibold mb-6">Create New Event</h1>
        
        <form className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Event Name</label>
            <input type="text" className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-slate-800 transition-colors outline-none text-xl" placeholder="e.g. Web3 Builders Meetup" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Location Type</label>
              <select className="w-full bg-slate-100 rounded-lg p-2.5 text-sm border-none outline-none">
                <option value="offline">Offline / In-person</option>
                <option value="virtual">Virtual / Online</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Capacity</label>
              <input type="number" defaultValue={100} className="w-full bg-slate-100 rounded-lg p-2.5 text-sm border-none outline-none" />
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input type="checkbox" className="form-checkbox h-4 w-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900" />
              <span className="text-sm font-medium">Require Approval</span>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="form-checkbox h-4 w-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900" />
              <span className="text-sm font-medium">Public Event</span>
            </label>
          </div>

          <button type="submit" className="w-full bg-slate-900 text-white font-medium py-3 rounded-xl hover:bg-slate-800 transition-colors mt-8">
            Create Event
          </button>
        </form>
      </div>
    </div>
  );
}
