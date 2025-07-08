"use client"
import { useState } from 'react'

export default function LeadMatcher() {
  const [input, setInput] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/lead-matcher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ input })
      })
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)
      const data = await res.json()
      setResults(data.results)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6">Fence360 Lead Matcher</h1>
      <form onSubmit={handleSubmit} className="mb-6 space-y-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          className="w-full p-3 border rounded-lg shadow-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Paste names or notes here"
        />
        <button
          type="submit"
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Submit'}
        </button>
      </form>
      {error && <p className="text-red-600 font-medium">Error: {error}</p>}
      {results.length > 0 && (
        <div className="overflow-auto">
          <table className="min-w-full bg-white border border-gray-200 text-sm text-left">
            <thead className="bg-gray-100 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 border">Query</th>
                <th className="px-4 py-2 border">Lead Name</th>
                <th className="px-4 py-2 border">Contract ID</th>
                <th className="px-4 py-2 border">Subtotal</th>
                <th className="px-4 py-2 border">Total</th>
                <th className="px-4 py-2 border">Rep Discount</th>
                <th className="px-4 py-2 border">ACH Discount</th>
                <th className="px-4 py-2 border">Discount Rate</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">{r.query}</td>
                  <td className="px-4 py-2 border">{r.lead_name}</td>
                  <td className="px-4 py-2 border">{r.contract_id || '—'}</td>
                  <td className="px-4 py-2 border">${r.subtotal.toFixed(2)}</td>
                  <td className="px-4 py-2 border">${r.total.toFixed(2)}</td>
                  <td className="px-4 py-2 border">${r.rep_discount.toFixed(2)}</td>
                  <td className="px-4 py-2 border">${r.ach_discount.toFixed(2)}</td>
                  <td className="px-4 py-2 border">{(r.discount_rate * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
