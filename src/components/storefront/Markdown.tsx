/** مُصيّر Markdown بسيط وآمن (عناوين، قوائم، فقرات، غامق) بدون مكتبات ولا HTML خام */
export function Markdown({ text, className = "prose-ar" }: { text: string; className?: string }) {
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");
    const lines = text.split(/\r?\n/); const out: string[] = []; let list: string[] = [];
    const flush = () => { if (list.length) { out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`); list = []; } };
    for (const l of lines) {
      if (/^\s*[-*] /.test(l)) { list.push(l.replace(/^\s*[-*] /, "")); continue; } flush();
      if (/^### /.test(l)) out.push(`<h3>${inline(l.slice(4))}</h3>`); else if (/^## /.test(l)) out.push(`<h2>${inline(l.slice(3))}</h2>`);
      else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
    } flush();
    return <div className={className} dangerouslySetInnerHTML={{ __html: out.join("") }} />;
  }
  