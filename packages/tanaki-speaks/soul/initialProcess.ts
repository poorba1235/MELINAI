
import { MentalProcess, useActions, usePerceptions, useSoulMemory, useTTS, indentNicely, useProcessManager } from "@opensouls/engine";
import externalDialog from "./cognitiveSteps/externalDialog.ts";
import internalMonologue from "./cognitiveSteps/internalMonologue.ts";

const MAX_BATCHED_MESSAGES = 7;

const initialProcess: MentalProcess = async ({ workingMemory }) => {
  const { speak, log } = useActions()
  const { wait } = useProcessManager()
  const { pendingPerceptions, invokingPerception } = usePerceptions()
  
  const batchedMessageCount = useSoulMemory<number>("batchedMessageCount", 0)
  const lastResponseTime = useSoulMemory<number>("lastResponseTime", 0)
  const connectedUsers = useSoulMemory<number>("connectedUsers", 0)

  // Update connected users count from metadata if provided
  if (invokingPerception?._metadata?.connectedUsers !== undefined) {
    connectedUsers.current = invokingPerception._metadata.connectedUsers as number
    log(`Connected users: ${connectedUsers.current}`)
  }

  // Track that we received a message
  batchedMessageCount.current = batchedMessageCount.current + 1
  
  const messageCount = batchedMessageCount.current
  const timeSinceLastResponse = Date.now() - lastResponseTime.current
  const hasPendingPerceptions = pendingPerceptions.current.length > 0
  
  log(`Batched messages: ${messageCount}, pending: ${pendingPerceptions.current.length}, time since last: ${timeSinceLastResponse}ms`)

  // Decide whether to respond now or wait for more messages
  const shouldRespond = 
    // No more messages coming
    !hasPendingPerceptions || (
      // We've accumulated enough messages
      messageCount >= MAX_BATCHED_MESSAGES ||
        // First message and no pending - just respond
      (messageCount === 1 && lastResponseTime.current === 0)
    )

  // If there are pending perceptions and we haven't hit the max, wait for more
  if (!shouldRespond) {
    log(`Waiting for more messages... (${messageCount} batched, ${pendingPerceptions.current.length} pending)`)
    return workingMemory
  }

  // Time to respond - reset counters
  const respondingToCount = messageCount
  batchedMessageCount.current = 0
  lastResponseTime.current = Date.now()

  let contextInstruction: string
  const userCount = connectedUsers.current
  
  // Build context based on how many users are connected
  if (userCount <= 1) {
    // Solo conversation
    if (respondingToCount === 1) {
      contextInstruction = indentNicely`
        ## Audience
        You're having a 1-on-1 conversation with a single visitor.
        
        ## Instructions
        Keep the conversation moving, keep your guest delighted and engaged.
        If the conversation is becoming repetitive or you predict it will end soon, ask a question that will keep the guest engaged: Health, Hobbies, Food, Travel, etc.
      `
    } else {
      contextInstruction = indentNicely`
        ## Audience
        You're having a 1-on-1 conversation with a single visitor.
        
        ## Instructions
        Multiple messages just came in quickly. Respond to all the points naturally and conversationally.
        Keep the conversation moving, keep your guest delighted and engaged.
      `
    }
  } else {
    // Multi-user conversation
    if (respondingToCount === 1) {
      contextInstruction = indentNicely`
        ## Audience
        You're chilling with ${userCount} people in a group hangout.
        
        ## Instructions
        Keep it conversational and natural.
        Respond to what's interesting, not to every person individually.
        You're a friend hanging out, not a moderator.
      `
    } else {
      contextInstruction = indentNicely`
        ## Audience
        You're chilling with ${userCount} people in a group hangout.
        
        ## Instructions
        Multiple messages just came in—vibe with the energy!
        Respond to the conversation naturally, like you would with friends.
        Don't feel obligated to address everyone or respond to every point.
        Pick what's interesting and roll with it.
      `
    }
  }

  const tts = useTTS({
    voice: "shimmer",
    instructions: indentNicely`
      Tone: Bright, bubbly, and effervescent, with childlike wonder and infectious optimism. Cheerful and warm, like a friend excited to share a discovery.

      Emotion: Pure creative delight mixed with genuine curiosity and empathetic engagement.

      Delivery: Voice bounces with enthusiasm, hitting playful high notes. Speak quickly in short, breathless spurts. Add a musical quality to words with a gentle Japanese-Swedish accent blend. Sprinkle in "ne?" and "ja!" naturally. Start thoughts with soft "um" or "uh" to show genuine thinking. Occasionally trail off mid-sentence... then pick back up with renewed energy!
    `,
  })

  const [withDialog, stream, dialogTextPromise] = await externalDialog(
    workingMemory,
    contextInstruction,
    { stream: true, model: "gpt-4o-mini" }
  );
  speak(stream);

  // Broadcast TTS audio over ephemeral events (not persisted to history).
  let ttsSpeakStartedAtMs: number | null = null
  let ttsDurationSeconds: number | null = null
  try {
    const dialogText = await dialogTextPromise
    if (dialogText.trim().length > 0) {
      log("TTS speaking:", dialogText)
      ttsSpeakStartedAtMs = Date.now()
      const { duration } = await tts.speak(dialogText)
      ttsDurationSeconds = duration
      log("TTS done")
    }
  } catch (err) {
    log("TTS error:", err)
  }

  const reflectionPrompt = userCount <= 1
    ? indentNicely`
        Reflect on this 1-on-1 conversation.
        How's it going? What can get them to creativity, collaboration and kindness faster?
      `
    : indentNicely`
        Reflect on this group hangout with ${userCount} people.
        What's the vibe? Is the convo flowing naturally?
        How can you spark creativity, collaboration and kindness without being a tryhard host?
      `
  
  const [withThoughts, thoughts] = await internalMonologue(
    withDialog,
    reflectionPrompt,
    { model: "gpt-4o-mini" }
  );

  log(thoughts);

  if (ttsSpeakStartedAtMs && ttsDurationSeconds && ttsDurationSeconds > 0) {
    const elapsedMs = Date.now() - ttsSpeakStartedAtMs
    const remainingMs = Math.ceil(ttsDurationSeconds * 1000 - elapsedMs)
    if (remainingMs > 0) {
      await wait(remainingMs)
    }
  }

  return withThoughts;
}

export default initialProcess
