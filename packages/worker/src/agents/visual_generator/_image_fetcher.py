"""Image fetching mixin — downloads scene images from Pexels/Freepik."""

import io
import json
import os
import re
import zipfile


class ImageFetcherMixin:
    """Mixin providing _fetch_scene_images for ClaudeVisualGenerator."""

    async def _fetch_scene_images(self) -> int:
        """
        Fetch images for scenes based on the Director's [IMAGE: keyword] entries.

        Reads scenes.json, downloads photos from Pexels and illustrations from Freepik,
        saves them to public/assets/images/, and updates scenes.json in-place.

        Returns the count of successfully downloaded images.
        """
        import httpx

        scenes_json_path = self.src_dir / "scenes.json"
        if not scenes_json_path.exists():
            print("[ClaudeGenerator] No scenes.json found — skipping image fetch")
            return 0

        with open(scenes_json_path, encoding="utf-8") as f:
            scenes_data = json.load(f)

        scenes = scenes_data.get("scenes", [])
        if not scenes:
            return 0

        # Collect all image requests
        image_tasks = []
        for si, scene in enumerate(scenes):
            images = scene.get("images", [])
            if not isinstance(images, list):
                continue
            for ii, img in enumerate(images[:2]):  # Max 2 per scene
                if len(image_tasks) >= 10:  # Max 10 total
                    break
                keyword = img.get("keyword", "")
                img_type = img.get("type", "photo")
                purpose = img.get("purpose", "accent")
                if keyword:
                    image_tasks.append({
                        "scene_index": si,
                        "image_index": ii,
                        "keyword": keyword,
                        "type": img_type,
                        "purpose": purpose,
                    })
            if len(image_tasks) >= 10:
                break

        if not image_tasks:
            print("[ClaudeGenerator] No image requests in scenes — skipping")
            return 0

        print(f"[ClaudeGenerator] Fetching {len(image_tasks)} images for scenes...")

        # Create images directory
        images_dir = self.workspace / "public" / "assets" / "images"
        images_dir.mkdir(parents=True, exist_ok=True)

        pexels_api_key = os.environ.get("PEXELS_API_KEY", "")
        freepik_api_key = os.environ.get("FREEPIK_API_KEY", "")

        downloaded = 0

        async with httpx.AsyncClient(timeout=30.0) as client:
            for task in image_tasks:
                try:
                    scene_id = scenes[task["scene_index"]].get("id", task["scene_index"] + 1)
                    slug = re.sub(r'[^a-z0-9]+', '-', task["keyword"].lower()).strip('-')[:30]
                    filename = f"scene{scene_id}-{task['purpose']}-{slug}.jpg"
                    dest_path = images_dir / filename

                    if task["type"] == "photo" and pexels_api_key:
                        downloaded += await self._fetch_pexels_photo(
                            client, task, scenes, dest_path, filename, pexels_api_key
                        )

                    elif task["type"] == "illustration" and freepik_api_key:
                        downloaded += await self._fetch_freepik_illustration(
                            client, task, scenes, dest_path, filename, freepik_api_key
                        )

                except Exception as e:
                    print(f"[ClaudeGenerator] Image fetch failed for '{task['keyword']}': {e}")
                    continue

        # Remove image entries that weren't successfully fetched
        for scene in scenes:
            if "images" in scene and isinstance(scene["images"], list):
                scene["images"] = [
                    img for img in scene["images"]
                    if isinstance(img, dict) and img.get("remotionPath")
                ]

        # Write updated scenes.json
        with open(scenes_json_path, "w", encoding="utf-8") as f:
            json.dump(scenes_data, f, indent=2)

        print(f"[ClaudeGenerator] Image fetch complete: {downloaded}/{len(image_tasks)} downloaded")
        return downloaded

    async def _fetch_pexels_photo(self, client, task, scenes, dest_path, filename, api_key) -> int:
        """Fetch a photo from Pexels. Returns 1 on success, 0 on failure."""
        resp = await client.get(
            "https://api.pexels.com/v1/search",
            params={"query": task["keyword"], "per_page": "3"},
            headers={"Authorization": api_key},
        )
        if resp.status_code != 200:
            return 0
        data = resp.json()
        photos = data.get("photos", [])
        if not photos:
            return 0

        photo = photos[0]
        photo_url = photo.get("src", {}).get("large", "")
        if not photo_url:
            return 0

        dl_resp = await client.get(photo_url)
        if dl_resp.status_code != 200:
            return 0
        dest_path.write_bytes(dl_resp.content)

        img_entry = scenes[task["scene_index"]]["images"][task["image_index"]]
        img_entry["localPath"] = str(dest_path)
        img_entry["remotionPath"] = f"assets/images/{filename}"
        img_entry["source"] = "pexels"
        img_entry["attribution"] = f"Photo by {photo.get('photographer', 'Unknown')} on Pexels"
        img_entry["width"] = photo.get("width")
        img_entry["height"] = photo.get("height")
        print(f"[ClaudeGenerator] Downloaded photo: {filename}")
        return 1

    async def _fetch_freepik_illustration(self, client, task, scenes, dest_path, filename, api_key) -> int:
        """Fetch an illustration from Freepik. Returns 1 on success, 0 on failure."""
        resp = await client.get(
            "https://api.freepik.com/v1/resources",
            params={
                "term": task["keyword"],
                "limit": "3",
                "filters[content_type][vector]": "1",
            },
            headers={
                "x-freepik-api-key": api_key,
                "Accept": "application/json",
            },
        )
        if resp.status_code != 200:
            return 0
        data = resp.json()
        resources = data.get("data", [])
        if not resources:
            return 0

        resource = resources[0]
        resource_id = str(resource.get("id", ""))
        if not resource_id:
            return 0

        dl_info_resp = await client.get(
            f"https://api.freepik.com/v1/resources/{resource_id}/download",
            headers={
                "x-freepik-api-key": api_key,
                "Accept": "application/json",
            },
        )
        if dl_info_resp.status_code != 200:
            return 0
        dl_info = dl_info_resp.json()
        dl_url = dl_info.get("data", {}).get("url", "")
        if not dl_url:
            return 0

        dl_resp = await client.get(dl_url)
        if dl_resp.status_code != 200:
            return 0

        raw_bytes = dl_resp.content

        # Freepik returns ZIP archives containing image + vector sources.
        # Extract the largest raster image from the ZIP.
        if len(raw_bytes) >= 4 and raw_bytes[:4] == b'PK\x03\x04':
            image_exts = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
            try:
                with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
                    image_entries = [
                        info for info in zf.infolist()
                        if not info.is_dir()
                        and os.path.splitext(info.filename)[1].lower() in image_exts
                        and info.file_size > 0
                    ]
                    image_entries.sort(key=lambda e: e.file_size, reverse=True)
                    if image_entries:
                        extracted = zf.read(image_entries[0].filename)
                        print(f"[ClaudeGenerator] Extracted {image_entries[0].filename} ({len(extracted)} bytes) from Freepik ZIP")
                        raw_bytes = extracted
                    else:
                        print(f"[ClaudeGenerator] Freepik ZIP has no raster images, skipping: {[i.filename for i in zf.infolist()]}")
                        return 0
            except zipfile.BadZipFile:
                print(f"[ClaudeGenerator] Bad ZIP from Freepik, saving raw download")

        dest_path.write_bytes(raw_bytes)

        img_entry = scenes[task["scene_index"]]["images"][task["image_index"]]
        img_entry["localPath"] = str(dest_path)
        img_entry["remotionPath"] = f"assets/images/{filename}"
        img_entry["source"] = "freepik"
        img_entry["attribution"] = "Illustration from Freepik"
        print(f"[ClaudeGenerator] Downloaded illustration: {filename}")
        return 1
