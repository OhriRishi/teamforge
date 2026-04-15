import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// In a real app we might dynamically fetch the guildId based on the team's discord_server_id in DB,
// but for now we'll take it from the request body or use a hardcoded fallback from the initial setup
const DISCORD_API_VERSION = 'v10'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, guildId } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Channel name is required' },
        { status: 400 }
      )
    }

    if (!guildId) {
      return NextResponse.json(
        { error: 'Discord Guild (Server) ID is required' },
        { status: 400 }
      )
    }

    const botToken = process.env.DISCORD_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json(
        { error: 'Discord Bot Token is not configured. Please add DISCORD_BOT_TOKEN to your .env.local file.' },
        { status: 500 }
      )
    }

    // Call Discord API to create a text channel
    const response = await fetch(`https://discord.com/api/${DISCORD_API_VERSION}/guilds/${guildId}/channels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name,
        type: 0, // 0 = GUILD_TEXT
        // We could also specify parent_id for categories, permission_overwrites, etc.
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Discord API Error:', data)
      return NextResponse.json(
        { error: data.message || 'Failed to create channel on Discord' },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true, channel: data })
  } catch (error) {
    console.error('Error in Discord channel creation API:', error)
    return NextResponse.json(
      { error: 'Internal server error while communicating with Discord' },
      { status: 500 }
    )
  }
}
