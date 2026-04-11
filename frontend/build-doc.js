const fs = require('fs');
const docx = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;

const doc = new Document({
  creator: "RelayPay Engineering",
  title: "RelayPay Voice Support Agent One-Pager",
  sections: [
    {
      properties: {},
      children: [
        // Header Region
        new Paragraph({
          text: "RelayPay Voice Support Agent",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Owner: ", bold: true }),
            new TextRun("Engineering & Customer Operations\n"),
            new TextRun({ text: "Key Links: ", bold: true }),
            new TextRun("RelayPay Voice Portal (relaypay-voice-support.vercel.app)\n"),
            new TextRun({ text: "Last Updated: ", bold: true }),
            new TextRun(new Date().toLocaleDateString('en-GB')),
          ],
          spacing: { after: 400 },
        }),

        // Purpose & Success Criteria
        new Paragraph({
          text: "Purpose & Success Criteria",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Who it’s for: ", bold: true }),
            new TextRun("RelayPay's business customers (CFOs, finance officers, founders, ops managers)."),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "What problem existed: ", bold: true }),
            new TextRun("Customers dealing with international transactions often require immediate, authoritative assistance without waiting on hold or typing long emails for critical operational issues (failed payouts, missing deposits, MFA issues)."),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "What it does: ", bold: true }),
            new TextRun("It provides an AI-powered voice agent that speaks naturally to customers in real-time. It automatically answers tier-1 and tier-2 payment inquiries. If unresolved, it triggers an instant escalation workflow, gathering details and escalating immediately to human agents on a live dashboard."),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "What changes if it works: ", bold: true }),
            new TextRun("Greatly reduced average handling time (AHT), 24/7 immediate verbal support, lowered human support overhead, and an overall premium \"white-glove\" SaaS perception for RelayPay users."),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "How success is measured: ", bold: true }),
            new TextRun("First-contact AI resolution rate (%), reduction in human ticket volume, lower time-to-escalation, and high post-call CSAT."),
          ],
          spacing: { after: 400 },
        }),

        // How it Works
        new Paragraph({
          text: "How it Works (High Level)",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun("1. AI Voice Engine: Powered by Vapi SDK, the user taps the mic button to speak. Real-time NLP transcribes, interprets intent, and synthesizes a professional spoken response using the engineered 'Elliot' persona."),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun("2. Real-time Knowledge: If the inquiry spans limits, API issues, or MFA resets, the agent retrieves answers logically. If the agent detects anger or an escalation need, it triggers a function call (tool hook)."),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun("3. Escalation Pipeline: The function call opens a visual escalation form. The user types their email and exact context. Submission pings the n8n webhook, which routes it seamlessly to the Supabase Agent Portal, notifying human agents."),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun("4. System Hook: Once escalated, n8n responds dynamically via Server-Sent Events, prompting the AI agent to explicitly confirm resolution to the user verbally."),
          ],
          spacing: { after: 400 },
        }),

        // How to Use It
        new Paragraph({
          text: "How to Use It",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Customer Persona (End User):", bold: true, italics: true }),
          ]
        }),
        new Paragraph({
          children: [
            new TextRun("• Visit the Voice Agent portal on desktop or mobile.\n"),
            new TextRun("• Click the highly visible Voice Button. Approve microphone permissions.\n"),
            new TextRun("• Speak naturally. Eg: \"Why was my transaction to Nigeria declined?\"\n"),
            new TextRun("• If unresolved, ask to speak to a human. A brief context form will appear. Submit your email.\n"),
            new TextRun("• The AI will confirm your submission verbally and end the interaction."),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Human Agent Persona (Operator):", bold: true, italics: true }),
          ],
          spacing: { before: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun("• Log in to the Agent portal using your agent credentials.\n"),
            new TextRun("• Monitor the dashboard; new escalations appear dynamically.\n"),
            new TextRun("• Review User Email, Error Category, and Description.\n"),
            new TextRun("• Update the status to 'IN_PROGRESS' and resolve via standard email channels.\n"),
            new TextRun("• After resolution, close the ticket."),
          ],
          spacing: { after: 400 },
        }),

        // Appendix
        new Paragraph({
          text: "Appendix",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun("Assumptions: End-users have functioning microphones. Agent portal users must be added to Supabase DB correctly (authenticated + agents table record).\n"),
            new TextRun("Limitations: The system relies externally on Vapi uptime, n8n pipeline latency, and Supabase realtime hooks.\n"),
            new TextRun("Troubleshooting: If voice fails, check browser mic permissions. If escalations fail, check the n8n webhook URL environment variables. If an agent can't see the dashboard, ensure their row in the `agents` table maps exactly to their `auth.users` UUID."),
          ],
        })
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("../RelayPay_Voice_Support_One_Pager.docx", buffer);
  console.log("Document created successfully at root dir!");
});
