// app/page.tsx

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Welcome</h1>
        <p className="text-gray-600">Go to <a href="/form" className="text-blue-600 underline">/form</a> to use the form.</p>
      </div>
    </main>
  )
}
