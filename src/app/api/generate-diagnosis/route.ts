import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: NextRequest) {
  try {
    const { questionnaireResults, motionAssessmentResults } = await req.json()

    const prompt = `
      Based on the following questionnaire results and motion assessment data, provide a diagnosis for a shoulder injury:

      Questionnaire Results:
      ${JSON.stringify(questionnaireResults, null, 2)}

      Motion Assessment Results:
      ${JSON.stringify(motionAssessmentResults, null, 2)}

      Please provide a diagnosis in the following JSON format:
      {
        "condition": "Name of the condition",
        "reasoning": "Explanation of the diagnosis based on the provided data",
        "exercises": ["Exercise 1", "Exercise 2", "Exercise 3", "Exercise 4"],
        "protocols": ["Protocol 1", "Protocol 2", "Protocol 3"],
        "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"],
        "nextSteps": ["Next step 1", "Next step 2", "Next step 3"]
      }
    `

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const diagnosis = JSON.parse(completion.choices[0].message.content || '{}')

    return NextResponse.json(diagnosis)
  } catch (error) {
    console.error('Error generating diagnosis:', error)
    return NextResponse.json({ error: 'Failed to generate diagnosis' }, { status: 500 })
  }
}