'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Activity, Dumbbell, Shield, Lightbulb, ArrowRight } from "lucide-react"

interface Diagnosis {
  condition: string;
  reasoning: string;
  exercises: string[];
  protocols: string[];
  suggestions: string[];
  nextSteps: string[];
}

export default function DiagnosisPage() {
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null)
  const router = useRouter()

  useEffect(() => {
    const storedDiagnosis = localStorage.getItem('diagnosis')
    if (storedDiagnosis) {
      setDiagnosis(JSON.parse(storedDiagnosis))
    } else {
      // If no diagnosis is found, redirect to the questionnaire
      router.push('/questionnaire')
    }
  }, [router])

  if (!diagnosis) {
    return <div>Loading diagnosis...</div>
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Your Injury Diagnosis</CardTitle>
          <CardDescription>Based on your symptoms and motion analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
              <AlertCircle className="text-red-500" />
              Condition
            </h2>
            <p className="text-lg font-medium">{diagnosis.condition}</p>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
              <Activity className="text-blue-500" />
              Reasoning
            </h2>
            <p>{diagnosis.reasoning}</p>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
              <Dumbbell className="text-green-500" />
              Recommended Exercises
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              {diagnosis.exercises.map((exercise, index) => (
                <li key={index}>{exercise}</li>
              ))}
            </ul>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
              <Shield className="text-purple-500" />
              Treatment Protocols
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              {diagnosis.protocols.map((protocol, index) => (
                <li key={index}>{protocol}</li>
              ))}
            </ul>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
              <Lightbulb className="text-yellow-500" />
              Suggestions
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              {diagnosis.suggestions.map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
              <ArrowRight className="text-orange-500" />
              Next Steps
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              {diagnosis.nextSteps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
      <div className="mt-6 text-center">
        <Link href="/" className="inline-block text-primary hover:underline">
          Back to Home
        </Link>
      </div>
    </div>
  )
}