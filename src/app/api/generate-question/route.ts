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
      model: "gpt-4o",
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

2. Only provide the potential diagnosis when you have gathered comprehensive information to make a well-informed evaluation.

3. Generate a motion assessment compatible with MoveNet pose estimation capabilities:
   - Focus on movements that can be accurately measured using the 17 key points detected by MoveNet: nose, eyes, ears, shoulders, elbows, wrists, hips, knees, and ankles.
   - Prioritize assessments involving changes in position or angles between these detectable points.
   - Avoid assessments requiring detection of fine motor skills or internal body movements.
   - For each assessment, provide clear, step-by-step instructions that will be used for text-to-speech guidance:
     a) Start with a clear setup instruction (e.g., "Stand facing the camera with your arms at your sides").
     b) Provide a simple, directive description of the movement to be performed (e.g., "Slowly raise both arms out to the sides until they are parallel to the ground").
     c) Include any specific details about speed, range of motion, or repetitions (e.g., "Hold this position for 3 seconds, then slowly lower your arms back down").
     d) If applicable, instruct on any variations or additional movements (e.g., "Repeat this motion 3 times").
   - Ensure the instructions are easy to follow without visual aids, as the user will only hear them.
   - For the technical assessment, clearly define:
     a) Specific joints or key points to be measured.
     b) The expected motion or change in position of these points.
     c) Criteria for successful completion based on MoveNet's output.
   - Specify which key points should be tracked, what measurements should be taken (e.g., angles, distances, velocities), and thresholds or ranges for successful completion.

Your response should be in JSON format with the following structure:
{
  "next_question": "The next question to ask, or null if assessment is ready",
  "assessment": {
    "diagnosis": "Concise potential diagnosis or explanation",
  },
  "motion_analysis": {
    "directions": "Clear, step-by-step instructions for the movement to be performed that will be used for text-to-speech guidance",
    "measurements": [
      {
        "type": "angle/distance/velocity",
        "points": ["Key points involved in this measurement"],
        "threshold": "Threshold or range for successful completion"
      }
    ]
  },
  "motion_assessment_ready": boolean
}
Only include the assessment and motion_analysis when you're ready to provide the final assessment. Set motion_assessment_ready to true when providing the final assessment.` },
        ...conversationHistory,
        { role: "assistant", content: currentQuestion },
        { role: "user", content: response },
        { role: "assistant", content: "Based on this response, what's the next most important question to ask about the patient's shoulder pain? If you have gathered sufficient information, provide a concise but comprehensive assessment as instructed." },
      ],
      response_format: { type: "json_object" },
      max_tokens: 3000,
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    // Ensure the response always has the expected structure
    const safeResult = {
      next_question: result.next_question || null,
      assessment: result.assessment || null,
      motion_analysis: result.motion_analysis || null,
      motion_assessment_ready: result.motion_assessment_ready || false
    }

    if (safeResult.motion_assessment_ready) {
      return NextResponse.json({
        next_question: null,
        assessment: result.assessment,
        motion_analysis: safeResult.motion_analysis,
        motion_assessment_ready: true,
      });
    }

    return NextResponse.json(safeResult)
  } catch (error) {
    console.error('OpenAI API error:', error)
    return NextResponse.json({ error: 'Failed to generate next question or assessment' }, { status: 500 })
  }
}
