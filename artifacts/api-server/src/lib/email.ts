import { logger } from "./logger";

interface OrderSummary {
  id: number;
  customerName: string;
  customerEmail: string;
  beerName: string;
  kegSize: string;
  quantity: number;
  pickupDate: string;
  pickupTime: string;
  pouringMethod: string;
  totalAmount: number;
}

interface ReceiptSummary {
  consumptionLocation?: string | null;
  consumptionDate?: string | null;
  consumptionTime?: string | null;
  purchaserDob?: string | null;
  validIdNumber?: string | null;
  vehicleYear?: string | null;
  vehicleMake?: string | null;
  vehicleColor?: string | null;
  vehiclePlate?: string | null;
}

function buildCustomerEmailHtml(order: OrderSummary, receipt: ReceiptSummary): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Keg Order Confirmation — Sawtooth Brewery</title></head>
<body style="font-family: Georgia, serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: hsl(28,90%,45%); color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin:0; font-size: 24px;">Sawtooth Brewery</h1>
    <p style="margin:8px 0 0; font-size: 14px; opacity: 0.9;">Keg Order Confirmation</p>
  </div>
  <div style="border: 1px solid #ddd; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
    <p>Dear <strong>${order.customerName}</strong>,</p>
    <p>Thank you for your keg order! Here's a summary of your order and the required Idaho State Police keg receipt you completed.</p>

    <h2 style="color: hsl(28,90%,45%); font-size: 16px; margin-top: 24px;">Order #${order.id}</h2>
    <table style="width:100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding:4px 0; color:#666; width:50%">Beer</td><td>${order.beerName} — ${order.kegSize}</td></tr>
      <tr><td style="padding:4px 0; color:#666">Quantity</td><td>${order.quantity}</td></tr>
      <tr><td style="padding:4px 0; color:#666">Pickup Date</td><td>${order.pickupDate} at ${order.pickupTime}</td></tr>
      <tr><td style="padding:4px 0; color:#666">Pouring Method</td><td>${order.pouringMethod}</td></tr>
      <tr><td style="padding:4px 0; color:#666; font-weight:bold">Pre-Authorization Total</td><td><strong>$${order.totalAmount.toFixed(2)}</strong></td></tr>
    </table>

    <h2 style="color: hsl(28,90%,45%); font-size: 16px; margin-top: 24px;">Idaho Keg Receipt (ISP)</h2>
    <table style="width:100%; border-collapse: collapse; font-size: 14px;">
      ${receipt.consumptionLocation ? `<tr><td style="padding:4px 0; color:#666; width:50%">Consumption Location</td><td>${receipt.consumptionLocation}</td></tr>` : ""}
      ${receipt.consumptionDate ? `<tr><td style="padding:4px 0; color:#666">Consumption Date</td><td>${receipt.consumptionDate}</td></tr>` : ""}
      ${receipt.consumptionTime ? `<tr><td style="padding:4px 0; color:#666">Consumption Time</td><td>${receipt.consumptionTime}</td></tr>` : ""}
      ${receipt.vehicleYear || receipt.vehicleMake ? `<tr><td style="padding:4px 0; color:#666">Vehicle</td><td>${[receipt.vehicleYear, receipt.vehicleMake, receipt.vehicleColor].filter(Boolean).join(" ")}</td></tr>` : ""}
      ${receipt.vehiclePlate ? `<tr><td style="padding:4px 0; color:#666">License Plate</td><td>${receipt.vehiclePlate}</td></tr>` : ""}
    </table>

    <p style="font-size: 12px; color: #888; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
      A $30 deposit has been pre-authorized on your card. It will be captured when we confirm your order.<br>
      We'll be in touch soon. Questions? Call us at the brewery.
    </p>
    <p style="font-size: 12px; color: #c00; font-weight: bold; text-transform: uppercase; margin-top: 8px;">
      Illegal resale of this product is a violation of Idaho State Law.
    </p>
  </div>
</body>
</html>
  `.trim();
}

function buildAdminEmailHtml(order: OrderSummary, receiptUrl: string | null): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New Keg Order #${order.id}</title></head>
<body style="font-family: sans-serif; color: #333; max-width: 500px; margin: 0 auto; padding: 20px;">
  <h2>New Keg Order Received — #${order.id}</h2>
  <p><strong>Customer:</strong> ${order.customerName} (${order.customerEmail})</p>
  <p><strong>Beer:</strong> ${order.beerName} — ${order.kegSize} × ${order.quantity}</p>
  <p><strong>Pickup:</strong> ${order.pickupDate} at ${order.pickupTime}</p>
  <p><strong>Pouring Method:</strong> ${order.pouringMethod}</p>
  <p><strong>Total:</strong> $${order.totalAmount.toFixed(2)}</p>
  <p>The customer has completed the ISP keg receipt form.</p>
  ${receiptUrl ? `<p><a href="${receiptUrl}" style="display:inline-block;background:hsl(28,90%,45%);color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">View Receipt &amp; Manage Order</a></p><p style="font-size:12px;color:#888;">Or copy: ${receiptUrl}</p>` : "<p>Log in to the admin dashboard to view and manage this order.</p>"}
</body>
</html>
  `.trim();
}

export async function sendOrderConfirmationEmails(
  order: OrderSummary,
  receipt: ReceiptSummary,
): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!smtpHost) {
    logger.info(
      { orderId: order.id, customerEmail: order.customerEmail },
      "Email mock (SMTP_HOST not set) — customer order confirmation would be sent here",
    );
    if (adminEmail) {
      const baseUrl = process.env.APP_BASE_URL ??
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null);
      const receiptUrl = baseUrl ? `${baseUrl}/pickup/${order.id}/forms` : null;
      logger.info(
        { orderId: order.id, adminEmail, receiptUrl },
        "Email mock — admin notification would be sent here",
      );
    }
    return;
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });

    const fromAddress = process.env.SMTP_FROM ?? "noreply@sawtoothbrewery.com";

    await transporter.sendMail({
      from: fromAddress,
      to: order.customerEmail,
      subject: `Keg Order #${order.id} Confirmed — Sawtooth Brewery`,
      html: buildCustomerEmailHtml(order, receipt),
    });

    if (adminEmail) {
      const baseUrl = process.env.APP_BASE_URL ??
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null);
      const receiptUrl = baseUrl ? `${baseUrl}/pickup/${order.id}/forms` : null;
      await transporter.sendMail({
        from: fromAddress,
        to: adminEmail,
        subject: `New Keg Order #${order.id} — ${order.customerName}`,
        html: buildAdminEmailHtml(order, receiptUrl),
      });
    }

    logger.info({ orderId: order.id }, "Order confirmation emails sent");
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Failed to send order confirmation emails");
  }
}
