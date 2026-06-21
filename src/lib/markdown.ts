// Renderer Markdown minimale per l'anteprima dei "momenti meme".
//
// NON usiamo una libreria esterna: il contenuto è breve testo digitato dal
// conduttore e ci bastano poche regole. L'input viene SEMPRE escapato come HTML
// prima di applicare le trasformazioni, così non può iniettare markup.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Inline: **grassetto**, *corsivo* / _corsivo_, `codice`.
function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/_([^_]+)_/g, "<em>$1</em>");
  return out;
}

/** Converte un sottoinsieme di Markdown in HTML (heading, liste, paragrafi). */
export function renderMarkdown(md: string): string {
  const righe = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inLista = false;

  const chiudiLista = () => {
    if (inLista) {
      out.push("</ul>");
      inLista = false;
    }
  };

  for (const riga of righe) {
    const t = riga.trim();
    if (t === "") {
      chiudiLista();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(t);
    if (heading) {
      chiudiLista();
      const livello = heading[1].length;
      out.push(`<h${livello}>${inline(heading[2])}</h${livello}>`);
      continue;
    }
    const lista = /^[-*]\s+(.*)$/.exec(t);
    if (lista) {
      if (!inLista) {
        out.push("<ul>");
        inLista = true;
      }
      out.push(`<li>${inline(lista[1])}</li>`);
      continue;
    }
    chiudiLista();
    out.push(`<p>${inline(t)}</p>`);
  }
  chiudiLista();
  return out.join("\n");
}
