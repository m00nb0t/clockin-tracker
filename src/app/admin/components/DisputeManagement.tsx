'use client';

import { useState, useEffect } from 'react';

interface Dispute {
  id: number;
  tipId: number;
  tipAmount: number;
  tipTimestamp: string;
  creatorName: string;
  disputedByName: string;
  reason: string;
  status: 'pending' | 'resolved' | 'rejected';
  createdAt: string;
  resolvedByName?: string;
  resolution?: string;
}

export default function DisputeManagement({ token }: { token: string }) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState('');
  const [showResolutionModal, setShowResolutionModal] = useState(false);

  useEffect(() => {
    fetchDisputes();
  }, [token]);

  const fetchDisputes = async () => {
    try {
      const response = await fetch('/api/admin/disputes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDisputes(data.disputes);
      }
    } catch (error) {
      console.error('Error fetching disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (dispute: Dispute, status: 'resolved' | 'rejected') => {
    if (!resolution.trim()) {
      alert('Please provide a resolution explanation.');
      return;
    }

    try {
      const response = await fetch(`/api/admin/disputes/${dispute.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          resolution: resolution.trim(),
        }),
      });

      if (response.ok) {
        await fetchDisputes();
        setShowResolutionModal(false);
        setSelectedDispute(null);
        setResolution('');
        alert(`Dispute ${status} successfully!`);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to resolve dispute');
      }
    } catch (error) {
      console.error('Error resolving dispute:', error);
      alert('Error resolving dispute');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Tip Dispute Management</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading disputes...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Tip Dispute Management</h3>
        <div className="text-sm text-gray-500">
          {disputes.filter(d => d.status === 'pending').length} pending
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <div key={dispute.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-medium text-gray-900">
                    ${dispute.tipAmount} tip dispute
                  </div>
                  <div className="text-sm text-gray-600">
                    {dispute.creatorName} • {new Date(dispute.tipTimestamp).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">
                    Disputed by: {dispute.disputedByName}
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  dispute.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : dispute.status === 'resolved'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {dispute.status}
                </span>
              </div>

              <div className="mb-3">
                <div className="text-sm font-medium text-gray-700">Reason:</div>
                <div className="text-sm text-gray-600">{dispute.reason}</div>
              </div>

              {dispute.status === 'pending' && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedDispute(dispute);
                      setShowResolutionModal(true);
                    }}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => handleResolve(dispute, 'rejected')}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              )}

              {dispute.status !== 'pending' && dispute.resolution && (
                <div className="mt-3 p-3 bg-gray-50 rounded">
                  <div className="text-sm font-medium text-gray-700">Resolution:</div>
                  <div className="text-sm text-gray-600">{dispute.resolution}</div>
                  {dispute.resolvedByName && (
                    <div className="text-xs text-gray-500 mt-1">
                      Resolved by {dispute.resolvedByName}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {disputes.length === 0 && (
          <p className="text-gray-500 text-center py-8">No disputes found.</p>
        )}

        {/* Resolution Modal */}
        {showResolutionModal && selectedDispute && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Resolve Dispute
                </h3>
                <div className="mb-4">
                  <div className="text-sm text-gray-600">
                    <strong>${selectedDispute.tipAmount}</strong> tip from <strong>{selectedDispute.creatorName}</strong><br />
                    Disputed by: <strong>{selectedDispute.disputedByName}</strong><br />
                    Reason: {selectedDispute.reason}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resolution Explanation *
                  </label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Explain how this dispute was resolved..."
                    required
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResolutionModal(false);
                      setSelectedDispute(null);
                      setResolution('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleResolve(selectedDispute, 'resolved')}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                  >
                    Resolve Dispute
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
