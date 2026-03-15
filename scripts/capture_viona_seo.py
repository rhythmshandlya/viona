"""
Capture screenshots and extract SEO/visual data from viona.app
"""
from playwright.sync_api import sync_playwright
import json
import os

SCREENSHOTS_DIR = "/Users/sarthakpant/project/clippify/screenshots"
URL = "https://viona.app"

VIEWPORTS = {
    "desktop": {"width": 1920, "height": 1080},
    "laptop": {"width": 1366, "height": 768},
    "tablet": {"width": 768, "height": 1024},
    "mobile": {"width": 375, "height": 812},
}

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        for name, vp in VIEWPORTS.items():
            ctx = browser.new_context(
                viewport=vp,
                device_scale_factor=2 if name == "mobile" else 1,
                is_mobile=(name == "mobile"),
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
                    if name == "mobile"
                    else None
                ),
            )
            page = ctx.new_page()
            page.goto(URL, wait_until="networkidle", timeout=30000)
            # above-the-fold (viewport only)
            page.screenshot(
                path=os.path.join(SCREENSHOTS_DIR, f"viona_{name}_above_fold.png"),
                full_page=False,
            )
            # full-page
            page.screenshot(
                path=os.path.join(SCREENSHOTS_DIR, f"viona_{name}_full.png"),
                full_page=True,
            )
            ctx.close()

        # --- SEO data extraction (desktop context) ---
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = ctx.new_page()
        page.goto(URL, wait_until="networkidle", timeout=30000)

        seo_data = page.evaluate("""() => {
            const data = {};

            // Meta viewport
            const vpMeta = document.querySelector('meta[name="viewport"]');
            data.viewportMeta = vpMeta ? vpMeta.getAttribute('content') : null;

            // Title
            data.title = document.title;

            // Meta description
            const descMeta = document.querySelector('meta[name="description"]');
            data.metaDescription = descMeta ? descMeta.getAttribute('content') : null;

            // OG tags
            const ogTags = {};
            document.querySelectorAll('meta[property^="og:"]').forEach(m => {
                ogTags[m.getAttribute('property')] = m.getAttribute('content');
            });
            data.ogTags = ogTags;

            // Canonical
            const canonical = document.querySelector('link[rel="canonical"]');
            data.canonical = canonical ? canonical.getAttribute('href') : null;

            // All headings
            const headings = [];
            document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
                const rect = h.getBoundingClientRect();
                headings.push({
                    tag: h.tagName,
                    text: h.textContent.trim().substring(0, 120),
                    visible: rect.width > 0 && rect.height > 0,
                    aboveFold: rect.top < window.innerHeight,
                    fontSize: window.getComputedStyle(h).fontSize,
                    fontWeight: window.getComputedStyle(h).fontWeight,
                    color: window.getComputedStyle(h).color,
                });
            });
            data.headings = headings;

            // Images without alt text
            const images = [];
            document.querySelectorAll('img').forEach(img => {
                const rect = img.getBoundingClientRect();
                images.push({
                    src: img.src ? img.src.substring(0, 150) : '',
                    alt: img.alt,
                    hasAlt: img.alt && img.alt.trim().length > 0,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    aboveFold: rect.top < window.innerHeight,
                    loading: img.loading || 'eager',
                });
            });
            data.images = images;

            // CTAs (buttons and links with CTA-like text)
            const ctas = [];
            document.querySelectorAll('a, button').forEach(el => {
                const text = el.textContent.trim();
                const rect = el.getBoundingClientRect();
                if (text.length > 0 && text.length < 60) {
                    const style = window.getComputedStyle(el);
                    ctas.push({
                        tag: el.tagName,
                        text: text,
                        href: el.href || null,
                        aboveFold: rect.top < window.innerHeight,
                        visible: rect.width > 0 && rect.height > 0,
                        top: Math.round(rect.top),
                        bgColor: style.backgroundColor,
                        color: style.color,
                        fontSize: style.fontSize,
                        padding: style.padding,
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                    });
                }
            });
            data.ctas = ctas;

            // Navigation
            const navs = [];
            document.querySelectorAll('nav, [role="navigation"]').forEach(nav => {
                const links = [];
                nav.querySelectorAll('a').forEach(a => {
                    links.push({ text: a.textContent.trim(), href: a.href });
                });
                navs.push({
                    ariaLabel: nav.getAttribute('aria-label'),
                    linkCount: links.length,
                    links: links,
                });
            });
            data.navigation = navs;

            // Body font info
            const bodyStyle = window.getComputedStyle(document.body);
            data.bodyFont = {
                fontFamily: bodyStyle.fontFamily,
                fontSize: bodyStyle.fontSize,
                lineHeight: bodyStyle.lineHeight,
                color: bodyStyle.color,
                backgroundColor: bodyStyle.backgroundColor,
            };

            // Check for structured data
            const jsonLds = [];
            document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
                try {
                    jsonLds.push(JSON.parse(s.textContent));
                } catch(e) {}
            });
            data.structuredData = jsonLds;

            // Links analysis
            const allLinks = [];
            document.querySelectorAll('a[href]').forEach(a => {
                allLinks.push({
                    text: a.textContent.trim().substring(0, 80),
                    href: a.href,
                    rel: a.rel || '',
                    target: a.target || '',
                    ariaLabel: a.getAttribute('aria-label') || '',
                });
            });
            data.allLinks = allLinks;

            // Accessibility: ARIA landmarks
            const landmarks = [];
            document.querySelectorAll('[role="banner"], [role="main"], [role="contentinfo"], [role="navigation"], main, header, footer, aside').forEach(el => {
                landmarks.push({
                    tag: el.tagName,
                    role: el.getAttribute('role') || el.tagName.toLowerCase(),
                    ariaLabel: el.getAttribute('aria-label') || '',
                });
            });
            data.landmarks = landmarks;

            // Font sizes used across page
            const fontSizes = new Set();
            document.querySelectorAll('p, span, a, li, div, h1, h2, h3, h4, h5, h6, button').forEach(el => {
                const fs = window.getComputedStyle(el).fontSize;
                fontSizes.add(fs);
            });
            data.fontSizesUsed = Array.from(fontSizes).sort();

            return data;
        }""")

        with open(os.path.join(SCREENSHOTS_DIR, "seo_data.json"), "w") as f:
            json.dump(seo_data, f, indent=2)

        print("SEO data extracted successfully.")
        print(f"Title: {seo_data.get('title')}")
        print(f"Viewport meta: {seo_data.get('viewportMeta')}")
        print(f"Images total: {len(seo_data.get('images', []))}")
        print(f"Images without alt: {sum(1 for i in seo_data.get('images', []) if not i.get('hasAlt'))}")
        print(f"Headings: {len(seo_data.get('headings', []))}")
        print(f"CTAs: {len(seo_data.get('ctas', []))}")
        print(f"Structured data blocks: {len(seo_data.get('structuredData', []))}")

        ctx.close()
        browser.close()

if __name__ == "__main__":
    run()
