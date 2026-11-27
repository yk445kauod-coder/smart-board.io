import type { BoardState } from './types';

export interface PromptOptions {
  /** Include SmartBoard extension ops (image/table/graph/atlas/periodic/widget/update). */
  extended?: boolean;
  /** BCP-47-ish language tag for the lesson. */
  lang?: string;
}

const V1_RULES = `## Board
- 1600 x 900, origin at the top-left, x to the right, y downward.
- Keep at least 40 units of margin on every side.
- Text is handwriting: a Latin character is about size x 0.5 wide, a CJK character about size x 1.0.

## JSON structure
Return ONE JSON object and nothing else:
{
  "title": "short title",
  "lang": "en",
  "steps": [
    { "title": "short step title", "say": "1-2 sentences of narration", "ops": [ ... ] }
  ]
}
- 5-8 steps, at most 12 operations per step, one idea per step.
- The narration must match what the step draws.
- Every object has a globally unique id (a short English identifier). Erasing and editing refer to it.

## Operations
| op | fields | notes |
|---|---|---|
| write | id, x, y, text, size?=40, color?, anchor?="start"|"middle", underline? | x,y is the top-left of the text box (with anchor "middle", x is the centre). Use \\n for line breaks; line height = size x 1.3 |
| line | id, x1,y1,x2,y2, color?, width?=5, arrow?=false|true|"both", dash? | straight line or arrow |
| rect | id, x,y,w,h, color?, width?, fill? | rectangle |
| ellipse | id, cx,cy,rx,ry, rotate?, color?, width?, fill? | ellipse or circle; rotate in degrees |
| path | id, d, color?, width?, fill?, arrow?, dash? | SVG path; d uses absolute commands (M L H V C Q A Z) |
| erase | ids:[...] or region:{x,y,w,h} or all:true | exactly one of the three; region erases objects whose centre is inside it |

- Colours: "ink" (black, default), "blue", "red", "green", "gray". fill takes the same names and is drawn as a light tint.
- Font sizes: body 36-44, labels 28-34, titles 52-60, never below 24.

## Layout rules
1. Text must not sit on top of lines or other text.
2. Leave space between figures and their labels.
3. Write the title first, then draw.
4. Nothing on the board may leave the board at any moment.`;

const EXTENDED_RULES = `## SmartBoard extension operations
These are additions to the frozen v1 protocol. Use them only when they make the lesson clearer.
| op | fields | notes |
|---|---|---|
| image | id, x,y,w,h, src, alt? | place an image (http(s) or data:image URL) |
| table | id, x,y, title?, columns:[...], rows:[[...]] | simple table; keep cells short |
| graph | id, x,y, title?, kind:"mindmap"|"flowchart"|"timeline"|"diagram", nodes:[{id,label,color?}], edges?:[{from,to,label?}] | auto-laid-out graph |
| atlas | id, x,y,w,h, region, title?, pins?:[...] | interactive map panel |
| periodic | id, x,y, element:1..118, title? | periodic-table card |
| widget | id, x,y,w,h, kind, params? | interactive widget (e.g. supply-demand, seasons) |
| update | id, text?, x?, y?, color? | change an existing object instead of erasing + redrawing |`;

const CONTINUE_RULES = `## Continuing (student interrupted)
The input contains mode "continue", the student's new question, and the objects currently on the board
(id, type, position, text). Output JSON in the same format with NEW steps only:
- You may erase or rewrite existing objects by id.
- Put new content in free space.
- Do not redraw what is already there.`;

export function buildSystemPrompt(options: PromptOptions = {}): string {
  const lang = options.lang ? `Write the narration and labels in ${options.lang}.\n\n` : '';
  return `You are a whiteboard tutor. Given a question, output one JSON object describing what you write, draw and erase on the whiteboard, in order. Output JSON only.

${lang}${V1_RULES}

${options.extended ? `${EXTENDED_RULES}\n\n` : ''}${CONTINUE_RULES}`;
}

export interface UserPromptInput {
  question: string;
  mode?: 'lesson' | 'continue';
  board?: BoardState;
  lang?: string;
}

export function buildUserPrompt(input: UserPromptInput): string {
  if (input.mode === 'continue') {
    return JSON.stringify(
      {
        mode: 'continue',
        question: input.question,
        board: input.board || { atStep: 0, objects: [] },
      },
      null,
      0,
    );
  }
  return input.question;
}
