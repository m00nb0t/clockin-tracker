'use client';

import { useState, useEffect } from 'react';

interface Creator {
  id: number;
  name: string;
  fanvueUuid: string | null;
  platform: 'fanvue' | 'other';
  active: boolean;
  createdAt: string;
}

interface CreatorFormData {
  name: string;
  fanvueUuid: string;
  platform: 'fanvue' | 'other';
  active: boolean;
}

export default function CreatorManagement() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingCreator, setEditingCreator] = useState<Creator | null>(null);
  const [bulkImportText, setBulkImportText] = useState('');
  const [bulkImportResults, setBulkImportResults] = useState<any>(null);
  const [formData, setFormData] = useState<CreatorFormData>({
    name: '',
    fanvueUuid: '',
    platform: 'fanvue',
    active: true,
  });

  useEffect(() => {
    fetchCreators();
  }, []);

  const fetchCreators = async () => {
    try {
      const response = await fetch('/api/admin/creators');
      if (response.ok) {
        const data = await response.json();
        setCreators(data.creators);
      }
    } catch (error) {
      console.error('Error fetching creators:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingCreator
        ? `/api/admin/creators/${editingCreator.id}`
        : '/api/admin/creators';

      const method = editingCreator ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          fanvueUuid: formData.platform === 'fanvue' ? formData.fanvueUuid : null,
        }),
      });

      if (response.ok) {
        await fetchCreators();
        resetForm();
        alert(editingCreator ? 'Creator updated successfully!' : 'Creator added successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save creator');
      }
    } catch (error) {
      console.error('Error saving creator:', error);
      alert('Error saving creator');
    }
  };

  const handleEdit = (creator: Creator) => {
    setEditingCreator(creator);
    setFormData({
      name: creator.name,
      fanvueUuid: creator.fanvueUuid || '',
      platform: creator.platform,
      active: creator.active,
    });
  };

  const handleBulkImport = async () => {
    if (!bulkImportText.trim()) {
      alert('Please enter creator data to import.');
      return;
    }

    try {
      let importData;
      try {
        importData = JSON.parse(bulkImportText);
      } catch (error) {
        alert('Invalid JSON format. Please check your data.');
        return;
      }

      if (!Array.isArray(importData)) {
        importData = [importData]; // Allow single object or array
      }

      const response = await fetch('/api/admin/creators?bulk=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creators: importData }),
      });

      const result = await response.json();

      if (response.ok) {
        setBulkImportResults(result);
        await fetchCreators();
        alert(result.message);
      } else {
        alert(result.error || 'Bulk import failed');
      }
    } catch (error) {
      console.error('Error in bulk import:', error);
      alert('Error during bulk import');
    }
  };

  const handleDelete = async (creator: Creator) => {
    if (!confirm(`Are you sure you want to deactivate "${creator.name}"? This will prevent it from being selected during clock-in.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/creators/${creator.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchCreators();
        alert('Creator deactivated successfully!');
      } else {
        alert('Failed to deactivate creator');
      }
    } catch (error) {
      console.error('Error deactivating creator:', error);
      alert('Error deactivating creator');
    }
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditingCreator(null);
    setFormData({
      name: '',
      fanvueUuid: '',
      platform: 'fanvue',
      active: true,
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Creator Management</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading creators...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Creator Management</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            Bulk Import
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Add Creator
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Creator Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Platform
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fanvue UUID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {creators.map((creator) => (
                <tr key={creator.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {creator.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {creator.platform}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">
                    {creator.fanvueUuid || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      creator.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {creator.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(creator)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(creator)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {creators.length === 0 && (
          <p className="text-gray-500 text-center py-8">No creators found.</p>
        )}

        {/* Add/Edit Form Modal */}
        {(showAddForm || editingCreator) && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingCreator ? 'Edit Creator' : 'Add New Creator'}
                </h3>

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Creator Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Alice Johnson"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Platform *
                    </label>
                    <select
                      required
                      value={formData.platform}
                      onChange={(e) => setFormData({ ...formData, platform: e.target.value as 'fanvue' | 'other' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="fanvue">Fanvue</option>
                      <option value="other">Other Platform</option>
                    </select>
                  </div>

                  {formData.platform === 'fanvue' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fanvue UUID *
                      </label>
                      <input
                        type="text"
                        required={formData.platform === 'fanvue'}
                        value={formData.fanvueUuid}
                        onChange={(e) => setFormData({ ...formData, fanvueUuid: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Required for Fanvue creators to receive automatic tips
                      </p>
                    </div>
                  )}

                  <div className="mb-6">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Active (available for selection)</span>
                    </label>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                    >
                      {editingCreator ? 'Update' : 'Add'} Creator
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Import Modal */}
        {showBulkImport && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-2xl shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Bulk Import Creators
                </h3>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    JSON Data
                  </label>
                  <textarea
                    value={bulkImportText}
                    onChange={(e) => setBulkImportText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={10}
                    placeholder={`[
  {
    "name": "Alice Johnson",
    "platform": "fanvue",
    "fanvueUuid": "123e4567-e89b-12d3-a456-426614174000",
    "active": true
  },
  {
    "name": "Bob Smith",
    "platform": "other",
    "active": true
  }
]`}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter JSON array of creators. Each creator should have name, platform, and optionally fanvueUuid and active fields.
                  </p>
                </div>

                {bulkImportResults && (
                  <div className="mb-4 p-3 bg-gray-50 rounded">
                    <h4 className="font-medium text-gray-900 mb-2">Import Results:</h4>
                    <div className="text-sm text-green-600">
                      ✅ {bulkImportResults.results?.successful?.length || 0} successful
                    </div>
                    <div className="text-sm text-red-600">
                      ❌ {bulkImportResults.results?.failed?.length || 0} failed
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBulkImport(false);
                      setBulkImportText('');
                      setBulkImportResults(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleBulkImport}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                  >
                    Import Creators
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
