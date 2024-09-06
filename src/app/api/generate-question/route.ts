import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  const { currentQuestion, response, conversationHistory } = await req.json()

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: `You are a world-class orthopedic specialist conducting a shoulder pain assessment. Your goal is to gather comprehensive information about the patient's shoulder pain before providing a final assessment. Follow these guidelines:

1. Ask a series of detailed questions (at least 8-10) to gather in-depth information about:
   - Specific pain characteristics (type, intensity, duration, frequency)
   - Precise onset and progression of symptoms
   - Detailed aggravating and alleviating factors
   - Comprehensive impact on daily activities and sleep
   - All previous treatments or medications tried and their effectiveness
   - Relevant medical history, including past injuries or conditions
   - Lifestyle factors, including occupation, sports, and hobbies
   - Family history of shoulder or joint issues

2. Only provide the final assessment when you have gathered comprehensive information to make a well-informed evaluation.

3. When providing the final assessment, be concise but professional. Include:
   - Brief diagnosis (1-2 sentences)
   - Key recommended exercises (2-3 bullet points)
   - Crucial daily routine adjustments (2-3 bullet points)
   - Essential precautions (1-2 bullet points)
   - Follow-up care advice (1 sentence)

4. Suggest a specific, detailed shoulder movement for motion analysis. Describe the movement clearly and explain its purpose.

Your response should be in JSON format with the following structure:
{
  "next_question": "The next question to ask, or null if assessment is ready",
  "assessment": {
    "diagnosis": "Concise potential diagnosis or explanation",
    "recommended_exercises": "Key exercises or stretches",
    "daily_routine": "Crucial routine adjustments",
    "precautions": "Essential precautions",
    "follow_up_care": "Brief follow-up advice"
  },
  "motion_analysis": "Detailed description of a specific shoulder movement to analyze",
  "motion_assessment_ready": boolean
}
Only include the assessment and motion_analysis when you're ready to provide the final assessment. Set motion_assessment_ready to true when providing the final assessment.` },
        ...conversationHistory,
        { role: "assistant", content: currentQuestion },
        { role: "user", content: response },
        { role: "assistant", content: "Based on this response, what's the next most important question to ask about the patient's shoulder pain? If you have gathered sufficient information, provide a concise but comprehensive assessment as instructed." },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    // Ensure the response always has the expected structure
    const safeResult = {
      next_question: result.next_question || null,
      assessment: result.assessment || null,
      motion_analysis: result.motion_analysis || null,
      motion_assessment_ready: result.motion_assessment_ready || false
    }

    return NextResponse.json(safeResult)
  } catch (error) {
    console.error('OpenAI API error:', error)
    return NextResponse.json({ error: 'Failed to generate next question or assessment' }, { status: 500 })
  }
}
