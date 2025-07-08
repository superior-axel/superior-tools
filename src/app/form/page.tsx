'use client'

import { useState } from 'react'

type ResultRow = {
  'Search Query': string
  'Lead ID': string
  'Lead Name': string
  'Contract ID': string | number
  'Subtotal': number
  'Total': number
  'Rep Discount': number
  'ACH Discount': number
  'Discount Rate': number
}

export default function HomePage() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ResultRow[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResults([])

    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
      })

      const data = await response.json()
      setResults(data.results || [])
    } catch (err) {
      console.error('Failed:', err)
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen text-black bg-gray-100 px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-2xl shadow-md mb-8"
        >
          <h1 className="text-2xl font-semibold mb-4">Lead & Contract Extractor</h1>
          <textarea
            rows={10}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste names here..."
            className="w-full border border-gray-300 rounded-xl px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Submit'}
          </button>
        </form>

        {results.length > 0 && (
          <div className="bg-white p-4 rounded-2xl shadow-md overflow-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  {Object.keys(results[0]).map((key) => (
                    <th key={key} className="px-4 py-2 whitespace-nowrap">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => (
                  <tr key={i} className="border-t">
                    {Object.values(row).map((value, j) => (
                      <td key={j} className="px-4 py-2 whitespace-nowrap">
                        {typeof value === 'number' ? value.toFixed(2) : value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
