import { Maily, render } from "@maily-to/render";

const doc = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1, textAlign: "left" },
      content: [{ type: "text", text: "Hello " }]
    },
    {
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: [
        { type: "text", text: "Hi " },
        {
          type: "variable",
          attrs: { id: "first_name", label: "First name", fallback: "there", showIfKey: null }
        },
        { type: "text", text: ", see you at " },
        {
          type: "variable",
          attrs: { id: "event_name", label: "Event name", fallback: null, showIfKey: null }
        }
      ]
    }
  ]
};

async function main() {
  const maily = new Maily(doc as never);
  maily.setShouldReplaceVariableValues(false);
  maily.setVariableFormatter(({ variable, fallback }) =>
    fallback ? `{{${variable}}}` : `{{${variable}}}`
  );
  const html = await maily.render({ pretty: true });
  console.log(html);
  console.log("\n--- render() ---\n");
  console.log(await render(doc as never, { pretty: true }));
}

main();
