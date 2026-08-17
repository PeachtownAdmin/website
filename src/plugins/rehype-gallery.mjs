// Groups runs of image-only paragraphs into a gallery.
//
// Blogger posts are often just a stack of photographs. Rendered one per
// paragraph inside a reading-width column they left most of the page empty and
// read as an upload dump. Grouped into a grid they read as a photo essay.

const isImageParagraph = (node) => {
  if (node.type !== "element" || node.tagName !== "p") return false;
  const meaningful = node.children.filter(
    (child) => !(child.type === "text" && child.value.trim() === "")
  );
  return meaningful.length > 0 && meaningful.every((child) => child.tagName === "img");
};

const imagesIn = (node) =>
  node.children.filter((child) => child.type === "element" && child.tagName === "img");

export function rehypeGallery() {
  return (tree) => {
    const out = [];
    let run = [];

    const flush = () => {
      if (run.length === 0) return;
      const images = run.flatMap(imagesIn);
      if (images.length < 2) {
        out.push(...run);
      } else {
        out.push({
          type: "element",
          tagName: "div",
          properties: { className: ["gallery"], "data-count": String(images.length) },
          children: images.map((image) => ({
            type: "element",
            tagName: "figure",
            properties: { className: ["gallery-item"] },
            children: [image],
          })),
        });
      }
      run = [];
    };

    for (const node of tree.children) {
      if (isImageParagraph(node)) {
        run.push(node);
        continue;
      }
      // Whitespace between paragraphs must not break a run.
      if (node.type === "text" && node.value.trim() === "") {
        if (run.length > 0) continue;
        out.push(node);
        continue;
      }
      flush();
      out.push(node);
    }
    flush();

    tree.children = out;
  };
}
