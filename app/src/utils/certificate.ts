import jsPDF from "jspdf";

interface CertificateData {
  hash: string;
  timestamp: Date;
  owner: string;
  transactionSignature: string;
}

export function generateCertificate(data: CertificateData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 25;
  const contentWidth = pageWidth - margin * 2;
  let y = 30;

  // Background
  doc.setFillColor(5, 5, 5);
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), "F");

  // Border
  doc.setDrawColor(100, 200, 255);
  doc.setLineWidth(0.5);
  doc.rect(15, 15, pageWidth - 30, doc.internal.pageSize.getHeight() - 30);

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("VOID PROTOCOL", pageWidth / 2, y, { align: "center" });

  y += 10;
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("PROOF OF EXISTENCE", pageWidth / 2, y, { align: "center" });

  // Divider
  y += 12;
  doc.setDrawColor(26, 26, 26);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);

  // Description
  y += 15;
  doc.setTextColor(160, 160, 160);
  doc.setFontSize(10);
  doc.text(
    "This certifies that a file with the following cryptographic",
    pageWidth / 2,
    y,
    { align: "center" },
  );
  y += 5;
  doc.text("hash existed at the stated time.", pageWidth / 2, y, {
    align: "center",
  });

  // Hash
  y += 20;
  doc.setTextColor(100, 200, 255);
  doc.setFontSize(9);
  doc.setFont("courier", "normal");
  doc.text("SHA-256 HASH", margin, y);
  y += 7;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  // Split hash into two lines if needed
  const hashLine1 = data.hash.substring(0, 32);
  const hashLine2 = data.hash.substring(32);
  doc.text(hashLine1, margin, y);
  if (hashLine2) {
    y += 5;
    doc.text(hashLine2, margin, y);
  }

  // Timestamp
  y += 15;
  doc.setTextColor(100, 200, 255);
  doc.setFontSize(9);
  doc.text("TIMESTAMP", margin, y);
  y += 7;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(
    data.timestamp.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }),
    margin,
    y,
  );

  // Owner
  y += 15;
  doc.setTextColor(100, 200, 255);
  doc.setFontSize(9);
  doc.setFont("courier", "normal");
  doc.text("REGISTERED BY", margin, y);
  y += 7;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(data.owner, margin, y);

  // Transaction
  y += 15;
  doc.setTextColor(100, 200, 255);
  doc.setFontSize(9);
  doc.text("TRANSACTION SIGNATURE", margin, y);
  y += 7;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text(data.transactionSignature, margin, y, {
    maxWidth: contentWidth,
  });

  // Divider
  y += 20;
  doc.setDrawColor(26, 26, 26);
  doc.line(margin, y, pageWidth - margin, y);

  // Footer
  y += 12;
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Verify at: voidprotocol.xyz/stamp", pageWidth / 2, y, {
    align: "center",
  });

  y += 8;
  doc.setFontSize(7);
  doc.text("Stored on the Solana blockchain. Immutable and permanent.", pageWidth / 2, y, {
    align: "center",
  });

  // Save
  const filename = `void-proof-${data.hash.substring(0, 8)}.pdf`;
  doc.save(filename);
}
