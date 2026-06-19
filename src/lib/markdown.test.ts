import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("rende heading e liste", () => {
    const html = renderMarkdown("# Titolo\n\n- uno\n- due");
    expect(html).toContain("<h1>Titolo</h1>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>uno</li>");
    expect(html).toContain("<li>due</li>");
  });

  it("rende grassetto, corsivo e codice inline", () => {
    expect(renderMarkdown("**forte**")).toContain("<strong>forte</strong>");
    expect(renderMarkdown("*piano*")).toContain("<em>piano</em>");
    expect(renderMarkdown("`x`")).toContain("<code>x</code>");
  });

  it("escapa l'HTML per evitare injection", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("trasforma le righe normali in paragrafi", () => {
    expect(renderMarkdown("ciao mondo")).toContain("<p>ciao mondo</p>");
  });
});
