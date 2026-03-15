"""
Capture screenshots of viona.app across multiple viewports for visual analysis.
"""
from playwright.sync_api import sync_playwright
import os

SCREENSHOTS_DIR = "/Users/sarthakpant/project/clippify/screenshots"
URL = "https://viona.app"

VIEWPORTS = [
    {"name": "desktop", "width": 1920, "height": 1080},
    {"name": "laptop", "width": 1366, "height": 768},
    {"name": "tablet", "width": 768, "height": 1024},
    {"name": "mobile", "width": 375, "height": 812},
]

def capture_screenshots():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()

        for vp in VIEWPORTS:
            name = vp["name"]
            w = vp["width"]
            h = vp["height"]
            print(f"\n{'='*60}")
            print(f"Capturing {name} ({w}x{h})...")
            print(f"{'='*60}")

            context_opts = {"viewport": {"width": w, "height": h}}
            if name == "mobile":
                context_opts["user_agent"] = (
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 "
                    "Mobile/15E148 Safari/604.1"
                )
                context_opts["is_mobile"] = True
                context_opts["has_touch"] = True
            elif name == "tablet":
                context_opts["user_agent"] = (
                    "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 "
                    "Mobile/15E148 Safari/604.1"
                )
                context_opts["is_mobile"] = True
                context_opts["has_touch"] = True

            context = browser.new_context(**context_opts)
            page = context.new_page()

            try:
                page.goto(URL, wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(2000)

                # Above-the-fold screenshot
                page.screenshot(
                    path=os.path.join(SCREENSHOTS_DIR, f"{name}_above_fold.png"),
                    full_page=False,
                )
                print(f"  Saved: {name}_above_fold.png")

                # Full page screenshot
                page.screenshot(
                    path=os.path.join(SCREENSHOTS_DIR, f"{name}_full_page.png"),
                    full_page=True,
                )
                print(f"  Saved: {name}_full_page.png")

                # Collect page metrics
                metrics = page.evaluate("""() => {
                    const body = document.body;
                    const html = document.documentElement;
                    const h1 = document.querySelector('h1');
                    const allHeadings = document.querySelectorAll('h1, h2, h3');
                    const headingTexts = [];
                    allHeadings.forEach(h => {
                        const rect = h.getBoundingClientRect();
                        headingTexts.push({
                            tag: h.tagName,
                            text: h.textContent?.trim()?.slice(0, 80),
                            aboveFold: rect.top < window.innerHeight,
                            top: Math.round(rect.top)
                        });
                    });

                    const buttons = document.querySelectorAll('a, button');
                    const ctaCandidates = [];
                    buttons.forEach(el => {
                        const rect = el.getBoundingClientRect();
                        const style = window.getComputedStyle(el);
                        const bg = style.backgroundColor;
                        const text = el.textContent?.trim()?.slice(0, 60);
                        if (text && rect.width > 0) {
                            ctaCandidates.push({
                                tag: el.tagName,
                                text: text,
                                href: el.href || '',
                                aboveFold: rect.top < window.innerHeight,
                                top: Math.round(rect.top),
                                width: Math.round(rect.width),
                                height: Math.round(rect.height),
                                bg: bg,
                                color: style.color,
                                fontSize: style.fontSize
                            });
                        }
                    });

                    const hasHorizontalScroll = body.scrollWidth > window.innerWidth;

                    const allText = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, a, li, button, label');
                    const fontSizes = [];
                    const fontSizeMap = {};
                    allText.forEach(el => {
                        const fs = parseFloat(window.getComputedStyle(el).fontSize);
                        const key = `${el.tagName}-${fs}`;
                        if (!fontSizeMap[key]) {
                            fontSizeMap[key] = true;
                            fontSizes.push({tag: el.tagName, fontSize: fs, sample: el.textContent?.slice(0, 40)});
                        }
                    });

                    const touchTargets = [];
                    const interactiveEls = document.querySelectorAll('a, button, input, select, textarea, [role="button"]');
                    interactiveEls.forEach(el => {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            touchTargets.push({
                                tag: el.tagName,
                                text: el.textContent?.slice(0, 30)?.trim(),
                                width: Math.round(rect.width),
                                height: Math.round(rect.height),
                                tooSmall: rect.width < 48 || rect.height < 48
                            });
                        }
                    });

                    // Check images
                    const images = document.querySelectorAll('img');
                    const imageData = [];
                    images.forEach(img => {
                        const rect = img.getBoundingClientRect();
                        imageData.push({
                            src: img.src?.slice(0, 80),
                            alt: img.alt || 'NO ALT',
                            naturalWidth: img.naturalWidth,
                            naturalHeight: img.naturalHeight,
                            displayWidth: Math.round(rect.width),
                            displayHeight: Math.round(rect.height),
                            loaded: img.complete && img.naturalHeight > 0,
                            aboveFold: rect.top < window.innerHeight
                        });
                    });

                    // Background colors for contrast check
                    const bodyBg = window.getComputedStyle(body).backgroundColor;
                    const bodyColor = window.getComputedStyle(body).color;

                    return {
                        pageWidth: body.scrollWidth,
                        pageHeight: Math.max(body.scrollHeight, html.scrollHeight),
                        viewportWidth: window.innerWidth,
                        viewportHeight: window.innerHeight,
                        hasHorizontalScroll,
                        headings: headingTexts,
                        ctaCandidates: ctaCandidates.filter(c => c.aboveFold).slice(0, 10),
                        navPresent: !!document.querySelector('nav, header'),
                        imageCount: images.length,
                        images: imageData.slice(0, 15),
                        fontSizes: fontSizes.sort((a, b) => a.fontSize - b.fontSize).slice(0, 20),
                        smallFontCount: fontSizes.filter(f => f.fontSize < 14).length,
                        tinyFontCount: fontSizes.filter(f => f.fontSize < 12).length,
                        allTouchTargets: touchTargets.length,
                        smallTouchTargets: touchTargets.filter(t => t.tooSmall),
                        smallTouchTargetCount: touchTargets.filter(t => t.tooSmall).length,
                        bodyBg,
                        bodyColor,
                        title: document.title,
                        metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || 'NONE',
                    };
                }""")

                print(f"\n  --- Page Info ---")
                print(f"  Title: {metrics['title']}")
                print(f"  Meta Description: {metrics['metaDescription'][:100]}")
                print(f"  Page size: {metrics['pageWidth']}x{metrics['pageHeight']}")
                print(f"  Viewport: {metrics['viewportWidth']}x{metrics['viewportHeight']}")
                print(f"  Horizontal scroll: {metrics['hasHorizontalScroll']}")
                print(f"  Body bg: {metrics['bodyBg']}, color: {metrics['bodyColor']}")

                print(f"\n  --- Headings ---")
                for h in metrics['headings'][:10]:
                    fold = "ABOVE" if h['aboveFold'] else "BELOW"
                    print(f"  [{fold}] <{h['tag']}> (top:{h['top']}px): {h['text']}")

                print(f"\n  --- CTAs Above Fold ---")
                for c in metrics['ctaCandidates'][:8]:
                    print(f"  <{c['tag']}> '{c['text']}' ({c['width']}x{c['height']}px, top:{c['top']}px)")
                    print(f"    bg:{c['bg']}, color:{c['color']}, font:{c['fontSize']}")
                    if c.get('href'):
                        print(f"    href: {c['href'][:80]}")

                print(f"\n  --- Images ---")
                print(f"  Total: {metrics['imageCount']}")
                for img in metrics['images'][:8]:
                    fold = "ABOVE" if img['aboveFold'] else "BELOW"
                    loaded = "OK" if img['loaded'] else "NOT LOADED"
                    print(f"  [{fold}][{loaded}] {img['displayWidth']}x{img['displayHeight']}px (natural: {img['naturalWidth']}x{img['naturalHeight']})")
                    print(f"    alt: {img['alt']}, src: {img['src']}")

                print(f"\n  --- Font Sizes ---")
                for fs in metrics['fontSizes'][:15]:
                    warn = " ** SMALL" if fs['fontSize'] < 14 else ""
                    print(f"  {fs['tag']}: {fs['fontSize']}px{warn} - '{fs['sample']}'")

                print(f"\n  --- Touch Targets ---")
                print(f"  Total interactive: {metrics['allTouchTargets']}")
                print(f"  Too small (<48px): {metrics['smallTouchTargetCount']}")
                for t in metrics['smallTouchTargets'][:10]:
                    print(f"  WARNING: {t['tag']} '{t['text']}' is {t['width']}x{t['height']}px")

            except Exception as e:
                print(f"  ERROR for {name}: {e}")
            finally:
                context.close()

        browser.close()
    print(f"\n{'='*60}")
    print(f"All screenshots saved to: {SCREENSHOTS_DIR}")
    print(f"{'='*60}")

if __name__ == "__main__":
    capture_screenshots()
