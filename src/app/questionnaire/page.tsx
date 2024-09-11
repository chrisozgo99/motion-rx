'use client'

import { useState, KeyboardEvent } from 'react'
import Link from "next/link"
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import ConversationHistory from '@/components/ui/ConversationHistory'

interface Assessment {
  diagnosis: string;
}

interface MotionAnalysis {
  description: string;
  key_points: string[];
  expected_motion: string;
  success_criteria: string;
  measurements: {
    type: string;
    points: string[];
    threshold: string;
  }[];
}

interface APIResponse {
  next_question: string | null;
  assessment: Assessment | null;
  motion_analysis: MotionAnalysis | null;
  motion_assessment_ready: boolean;
}

export default function Questionnaire() {
  const router = useRouter()
  const [currentQuestion, setCurrentQuestion] = useState<string>("Describe your shoulder pain:")
  const [response, setResponse] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string, content: string }>>([])
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [motionAnalysis, setMotionAnalysis] = useState<MotionAnalysis | null>(null)
  const [isAssessmentReady, setIsAssessmentReady] = useState<boolean>(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLoading || !response.trim()) return

    setIsLoading(true)

    try {
      const res = await fetch('/api/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentQuestion, response, conversationHistory }),
      })

      if (!res.ok) throw new Error('Failed to generate next question or assessment')

      const data: APIResponse = await res.json()
      console.log('API Response:', data)
      
      const updatedHistory = [
        ...conversationHistory,
        { role: "assistant", content: currentQuestion },
        { role: "user", content: response }
      ]
      
      setConversationHistory(updatedHistory)
      console.log('Conversation History:', updatedHistory)

      if (data.motion_assessment_ready) {
        setIsAssessmentReady(true);
        setAssessment(data.assessment);
        setMotionAnalysis(data.motion_analysis);
        
        // Store questionnaire data
        localStorage.setItem('questionnaireData', JSON.stringify({
          conversationHistory,
          assessment: data.assessment,
        }));
      } else {
        setCurrentQuestion(data.next_question || "No more questions.");
      }
      setResponse('')
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
    }
  }

  const renderAssessment = () => {
    if (!assessment) return null;
    return (
      <div className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-md mb-4">
          <h3 className="font-bold text-lg mb-2">Preliminary Diagnosis</h3>
          <p>{assessment.diagnosis}</p>
        </div>
        <div className="bg-blue-50 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-bold mb-4">Motion Analysis</h3>
          {motionAnalysis && (
            <div>
              <p className="mb-2"><strong>Description:</strong> {motionAnalysis.description}</p>
            </div>
          )}
          <button
            onClick={() => {
              if (motionAnalysis && assessment) {
                localStorage.setItem('motionAnalysis', JSON.stringify(motionAnalysis))
                localStorage.setItem('assessment', JSON.stringify(assessment))
                router.push('/motion-analysis')
              }
            }}
            className="w-full py-3 px-4 bg-[black] text-white rounded-md hover:bg-[black]/80 transition-colors"
          >
            Start Motion Analysis
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl w-full relative">
        <Link
          href="/"
          className="absolute top-0 left-0 inline-flex items-center px-3 py-1 text-xs font-medium rounded-md text-black bg-white focus:outline-none"
        >
          ← Home
        </Link>
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
              <label className="block text-lg font-medium text-gray-700 mb-2">
                {currentQuestion}
              </label>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                onKeyDown={handleKeyDown}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 transition duration-150 ease-in-out
                           px-4 py-3 text-base resize-none
                           bg-white hover:bg-gray-50"
                rows={6}
                placeholder="Type your answer here..."
              />
              <button
                type="submit"
                disabled={isLoading || !response.trim()}
                className="w-full inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-white shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <ConversationHistory history={conversationHistory} />
    </div>
  )
}
