

## Remove "Hit $1M market cap" stat from landing page

Remove the "$1M market cap" milestone/stat block from the static landing template so it no longer renders on the homepage.

### Change

- File: `public/popshiba-template/launch.html`
- Locate the stat/milestone element containing the text "Hit $1M market cap" (and its `0` counter) and delete that block (the entire stat card / list item) along with any now-empty wrapper.
- Adjust the surrounding grid so remaining stats stay evenly distributed (no orphan column).

No React, route, or DB changes required.

