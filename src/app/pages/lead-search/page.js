'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

export default function LeadMatcherPage() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/lead-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })
      const data = await res.json()
      setResults(data.results || [])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen p-4 bg-gray-50 space-y-6">
      <Card className="max-w-3xl mx-auto border">
        <CardContent className="p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h1 className="text-xl font-semibold text-gray-800">Lead Matcher</h1>
            <Textarea
              placeholder="Paste names or contracts here"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="h-60"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : 'Submit'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="max-w-6xl mx-auto border">
          <CardContent className="p-4 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Search Query</TableHead>
                  <TableHead>Lead Name</TableHead>
                  <TableHead>Lead ID</TableHead>
                  <TableHead>Contract ID</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Rep Discount</TableHead>
                  <TableHead>ACH Discount</TableHead>
                  <TableHead>Discount Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{row.searchQuery}</TableCell>
                    <TableCell>{row.leadName}</TableCell>
                    <TableCell>{row.leadId}</TableCell>
                    <TableCell>{row.contractId || '-'}</TableCell>
                    <TableCell>${row.subtotal.toFixed(2)}</TableCell>
                    <TableCell>${row.total.toFixed(2)}</TableCell>
                    <TableCell>${row.repDiscount.toFixed(2)}</TableCell>
                    <TableCell>${row.achDiscount.toFixed(2)}</TableCell>
                    <TableCell>{(row.discountRate * 100).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
