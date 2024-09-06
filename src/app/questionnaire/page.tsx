

'use client'

import { useState } from 'react'
import Link from "next/link"
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

export default function Questionnaire() {
  const router = useRouter()
  const [currentQuestion, setCurrentQuestion] = useState<string>("Describe your shoulder pain:")
  const [response, setResponse] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string, content: string }>>([])
  const [isAssessmentReady, setIsAssessmentReady] = useState<boolean>(false)
  const [motionAssessment, setMotionAssessment] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const res = await fetch('/api/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentQuestion, response, conversationHistory }),
      })

      if (!res.ok) throw new Error('Failed to generate next question or assessment')

      const data = await res.json()
      
      if (data.nextQuestion.startsWith("MOTION_ASSESSMENT:")) {
        setIsAssessmentReady(true)
        setMotionAssessment(data.nextQuestion.substring("MOTION_ASSESSMENT:".length).trim())
      } else {
        setCurrentQuestion(data.nextQuestion)
        setConversationHistory([...conversationHistory, 
          { role: "assistant", content: currentQuestion },
          { role: "user", content: response }
        ])
      }
      setResponse('')
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const renderAssessment = () => {
    const sections = motionAssessment.split(/\d+\./).filter(Boolean)
    return (
      <div className="space-y-4">
        {sections.map((section, index) => {
          const [title, ...content] = section.split(':')
          return (
            <div key={index} className="border-b pb-4">
              <h3 className="font-bold text-lg">{title.trim()}</h3>
              <p>{content.join(':').trim()}</p>
              {title.trim() === "Motion Analysis" && (
                <button
                  onClick={() => router.push(`/motion-analysis?prompt=${encodeURIComponent(content.join(':').trim())}`)}
                  className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Start Motion Analysis
                </button>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl w-full">
        <h1 className="text-3xl font-bold mb-6 text-center">Shoulder Pain Assessment</h1>
        <AnimatePresence mode="wait">
          {!isAssessmentReady ? (
            <motion.form
              key={currentQuestion}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <label className="block text-sm font-medium text-gray-700">
                {currentQuestion}
              </label>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                rows={4}
              />
              <button
                type="submit"
                disabled={isLoading || !response.trim()}
                className="w-full inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Next'}
              </button>
            </motion.form>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold">Comprehensive Shoulder Assessment</h2>
              {renderAssessment()}
              <div className="mt-6">
                <Link href="/" className="inline-block text-primary hover:underline">
                  Back to Home
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
