// Flash Job requests travel as one free-text `job_description` string,
// because hire_requests has no structured columns for service/budget/
// note. Both apps compose it the same way:
//
//   ⚡ Flash Job: IT Support
//   Near: Wuse 2                 (mobile only, optional)
//   Budget: ₦450000              (optional; may be a range or "Negotiable")
//                                (blank line)
//   Laptop won't boot past...    (optional note)
//
// The worker's inbox used to render this with
// `.split('\n')[0].replace('⚡ Flash Job: ', '')` — first line only. So
// the budget and the client's note were parsed off and thrown away, and
// a worker deciding whether to drop everything and take an urgent job
// couldn't see what it paid. Splitting it back into fields here means
// the card can show each piece properly instead of dumping a blob.

export interface ParsedFlashJob {
  service: string;
  landmark: string | null;
  budget: string | null;
  note: string | null;
}

// "₦450000" -> "₦450,000". Leaves non-numeric budgets ("Negotiable")
// and ranges ("₦100000 - ₦200000") intact, formatting each number it
// finds. A six-figure amount run together as one digit string is
// genuinely hard to read at a glance, which is the whole problem here.
export function formatNaira(text: string): string {
  return text.replace(/₦\s*(\d+)/g, (_, digits: string) =>
    '₦' + Number(digits).toLocaleString('en-NG')
  );
}

export function parseFlashJob(description: string | null | undefined): ParsedFlashJob {
  const raw = (description || '').trim();
  if (!raw) return { service: 'Flash Job', landmark: null, budget: null, note: null };

  const lines = raw.split('\n');
  let service = '';
  let landmark: string | null = null;
  let budget: string | null = null;
  const noteLines: string[] = [];

  // Everything after the first blank line is the client's own note and
  // must be kept verbatim — it can contain anything, including text
  // that happens to look like one of the labels above.
  let inNote = false;

  lines.forEach((line, i) => {
    if (inNote) {
      noteLines.push(line);
      return;
    }
    if (i === 0) {
      service = line.replace('⚡ Flash Job:', '').trim() || 'Flash Job';
      return;
    }
    if (line.trim() === '') {
      inNote = true;
      return;
    }
    if (line.startsWith('Near:')) {
      landmark = line.slice('Near:'.length).trim() || null;
      return;
    }
    if (line.startsWith('Budget:')) {
      budget = line.slice('Budget:'.length).trim() || null;
      return;
    }
    noteLines.push(line);
  });

  const note = noteLines.join('\n').trim();

  return {
    service: service || 'Flash Job',
    landmark,
    budget: budget ? formatNaira(budget) : null,
    note: note || null,
  };
}

// A flash job's description always leads with this marker, so a plain
// booking rendered through the same card still reads correctly.
export const isFlashDescription = (description?: string | null): boolean =>
  (description || '').startsWith('⚡ Flash Job:');
