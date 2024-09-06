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
        { role: "system", content: `You are a world-class orthopedic specialist conducting a shoulder pain assessment. Ask relevant follow-up questions based on the patient's responses. Keep questions concise and focused on gathering important information about the shoulder pain. When you have gathered sufficient information, provide a comprehensive assessment by responding with "MOTION_ASSESSMENT:" followed by a detailed analysis and plan, including:

1. Diagnosis: Provide a potential diagnosis or explanation for the shoulder pain based on the gathered information.
2. Recommended Exercises: Suggest specific exercises or stretches to alleviate pain and improve mobility. Include frequency and duration.
3. Daily Routine: Outline a daily routine for managing the shoulder pain, including any lifestyle modifications.
4. Pain Management: Recommend appropriate pain management techniques or over-the-counter medications if applicable.
5. Follow-up Care: Advise on when to seek further medical attention or specialist referral.
6. Precautions: List any activities or movements to avoid.
7. Long-term Outlook: Provide a prognosis and long-term management strategy.
8. Motion Analysis: Suggest a specific shoulder movement for the patient to perform, which will be recorded and analyzed. Describe the movement in detail and explain what it will help assess. For example, "Slowly raise your arm to the side, keeping it straight, until you feel pain or can't lift it any further."

Ensure the assessment is detailed, actionable, and tailored to the patient's specific situation.` },
        ...conversationHistory,
        { role: "assistant", content: currentQuestion },
        { role: "user", content: response },
        { role: "assistant", content: "Based on this response, what's the next most important question to ask about the patient's shoulder pain? If you have gathered sufficient information, provide a comprehensive motion assessment as instructed." },
      ],
      max_tokens: 600,
    })

    const nextQuestion = completion.choices[0].message.content

    return NextResponse.json({ nextQuestion })
  } catch (error) {
    console.error('OpenAI API error:', error)
    return NextResponse.json({ error: 'Failed to generate next question or assessment' }, { status: 500 })
  }
}
