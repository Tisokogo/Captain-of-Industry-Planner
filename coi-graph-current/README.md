# COI Recipe Graph

![screenshot](./public/screenshot.png)

Graph of recipes and materials for the game [Captain of Industry](https://www.captain-of-industry.com/).

Recipes data and game logo belongs to the game developers, [MaFi Games](https://www.linkedin.com/company/mafi-games/).

# Development

Requires `deno@^2.4.0`.

```bash
# as two parallel tasks
deno task bundle
deno task serve
```

## Extract recipes

To extract recipes from the game files, run:

```bash
deno task extract
```