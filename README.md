# mcp-jisho

Jisho.org Japanese-English dictionary MCP (keyless).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_words` | Search the Jisho.org Japanese<->English dictionary. The keyword can be English (translate to Japanese), Japanese kanji/kana, or romaji. Returns up to `limit` matching dictionary entries, each with the headword (slug), whether it is a common word, JLPT level, all readings/spellings, and English meanings grouped into senses with parts of speech. Use this to translate, look up a kanji/kana word, or find Japanese words for an English concept. |
| `lookup` | Look up a single Japanese or English word in the Jisho.org dictionary and return only the single best/first matching entry in a compact form: headword (slug), common-ness, JLPT level, all readings, a flat list of English meanings, and the unique parts of speech. Best for quick "what does this word mean / how is it read" questions. Accepts kanji, kana, romaji, or English. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "jisho": {
      "url": "https://gateway.pipeworx.io/jisho/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Jisho data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
