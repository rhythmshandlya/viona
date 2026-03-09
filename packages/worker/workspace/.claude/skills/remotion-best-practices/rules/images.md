---
name: images
description: Embedding images in Remotion using the <Img> component
metadata:
  tags: images, img, staticFile, png, jpg, svg, webp
---

# Using images in Remotion

## The `<Img>` component

Always use the `<Img>` component from `remotion` to display images:

```tsx
import { Img, staticFile } from "remotion";

export const MyComposition = () => {
  return <Img src={staticFile("photo.png")} />;
};
```

## Important restrictions

**You MUST use the `<Img>` component from `remotion`.** Do not use:

- Native HTML `<img>` elements
- Next.js `<Image>` component
- CSS `background-image`

The `<Img>` component ensures images are fully loaded before rendering, preventing flickering and blank frames during video export.

## Local images with staticFile()

Place images in the `public/` folder and use `staticFile()` to reference them:

```
my-video/
├─ public/
│  ├─ logo.png
│  ├─ avatar.jpg
│  └─ icon.svg
├─ src/
├─ package.json
```

```tsx
import { Img, staticFile } from "remotion";

<Img src={staticFile("logo.png")} />
```

## Remote images

**NEVER use remote URLs for icons or images.** External URLs (icons8, flaticon, etc.) will
fail during rendering due to CORS, rate limits, or unavailability. This crashes the entire render.

Instead:
- **Icons**: Download via Freepik MCP or Iconify/better-icons → inline the SVG directly in JSX. For company/brand logos, use Iconify `simple-icons:*` first (3000+ official brand SVGs).
- **Photos/illustrations**: Download via asset tools → use `staticFile('assets/...')`
- **Pre-fetched images**: Use the `remotionPath` from scenes.json with `staticFile()`

For animated GIFs, use the `<Gif>` component from `@remotion/gif` instead.

## Sizing and positioning

Use the `style` prop to control size and position:

```tsx
<Img
  src={staticFile("photo.png")}
  style={{
    width: 500,
    height: 300,
    position: "absolute",
    top: 100,
    left: 50,
    objectFit: "cover",
  }}
/>
```

## Dynamic image paths

Use template literals for dynamic file references:

```tsx
import { Img, staticFile, useCurrentFrame } from "remotion";

const frame = useCurrentFrame();

// Image sequence
<Img src={staticFile(`frames/frame${frame}.png`)} />

// Selecting based on props
<Img src={staticFile(`avatars/${props.userId}.png`)} />

// Conditional images
<Img src={staticFile(`icons/${isActive ? "active" : "inactive"}.svg`)} />
```

This pattern is useful for:

- Image sequences (frame-by-frame animations)
- User-specific avatars or profile images
- Theme-based icons
- State-dependent graphics

## Getting image dimensions

Use `getImageDimensions()` to get the dimensions of an image:

```tsx
import { getImageDimensions, staticFile } from "remotion";

const { width, height } = await getImageDimensions(staticFile("photo.png"));
```

This is useful for calculating aspect ratios or sizing compositions:

```tsx
import { getImageDimensions, staticFile, CalculateMetadataFunction } from "remotion";

const calculateMetadata: CalculateMetadataFunction = async () => {
  const { width, height } = await getImageDimensions(staticFile("photo.png"));
  return {
    width,
    height,
  };
};
```
