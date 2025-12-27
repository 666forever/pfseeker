import fs from "fs";
import path from "path";
import exifr from "exifr";

const sections = ["pfps", "banners"];

function collectTags(meta) {
  let raw = [];

  // String-based Windows / XMP fields
  if (typeof meta?.XPKeywords === "string") {
    raw.push(meta.XPKeywords);
  }

  if (typeof meta?.LastKeywordXMP === "string") {
    raw.push(meta.LastKeywordXMP);
  }

  if (typeof meta?.subject === "string") {
    raw.push(meta.subject);
  }

  // Array-based IPTC / XMP fields
  if (Array.isArray(meta?.Keywords)) {
    raw.push(...meta.Keywords);
  }

  if (Array.isArray(meta?.Subject)) {
    raw.push(...meta.Subject);
  }

  // Normalize + split
  return [...new Set(
    raw
      .flatMap(v =>
        typeof v === "string"
          ? v.split(";")
          : [v]
      )
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)
  )];
}

async function generate() {
  for (const section of sections) {
    const imagesDir = path.join(section, "images");
    const outputFile = path.join(section, "images_list.js");

    if (!fs.existsSync(imagesDir)) {
      console.warn(`⚠ Skipping ${section}, no images folder`);
      continue;
    }

    const files = fs
      .readdirSync(imagesDir)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .sort();

    const images = [];

    for (const file of files) {
      const fullPath = path.join(imagesDir, file);
      let tags = [];

      try {
        const meta = await exifr.parse(fullPath, {
          iptc: true,
          xmp: true,
          exif: true
        });

        tags = collectTags(meta);
      } catch {
        tags = [];
      }

      images.push({ file, tags });
    }

    const varName =
      section === "pfps" ? "pfpImages" : "bannerImages";

    const content =
`window.${varName} = ${JSON.stringify(images, null, 2)};
`;

    fs.writeFileSync(outputFile, content, "utf8");
    console.log(`✔ Generated ${outputFile}`);
  }
}

generate();
