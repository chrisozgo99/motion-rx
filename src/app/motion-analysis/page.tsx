'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function MotionAnalysis() {
  const searchParams = useSearchParams()
  const [prompt, setPrompt] = useState('')
  const [isAnalysisStarted, setIsAnalysisStarted] = useState(false)

  useEffect(() => {
    const promptParam = searchParams.get('prompt')
    if (promptParam) {
      setPrompt(decodeURIComponent(promptParam))
    }
  }, [searchParams])

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl w-full">
        <h1 className="text-3xl font-bold mb-6 text-center">Motion Analysis</h1>
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Instructions:</h2>
          <p className="mb-4">{prompt}</p>
          {!isAnalysisStarted ? (
            <button
              onClick={() => setIsAnalysisStarted(true)}
              className="w-full inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Start Analysis
            </button>
          ) : (
            <div className="space-y-4">
              <p className="font-bold">Motion Analysis in Progress</p>
              <p>Please perform the suggested movement. The camera will record and analyze your motion.</p>
              {/* Placeholder for future camera integration */}
              <div className="bg-gray-200 h-48 flex items-center justify-center">
                <p>Camera feed placeholder</p>
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 text-center">
          <Link href="/questionnaire" className="inline-block text-primary hover:underline">
            Back to Assessment
          </Link>
        </div>
      </div>
    </div>
  )
}
