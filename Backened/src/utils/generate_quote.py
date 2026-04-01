"""
backend/src/utils/generate_quote.py

Called by quoteRoute.js via python-shell.
Receives one JSON argument: the job data dict.
Writes a PDF to job_data['output_path'].

Install:  pip install reportlab
"""

import sys
import json
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas

# ── Logo path — update this to wherever you store the logo on your server ──
import os
LOGO = os.path.join(os.path.dirname(__file__), "logo.png")

W, H = A4

ORANGE = colors.HexColor("#E87722")
DARK   = colors.HexColor("#1a1d2e")
GREY   = colors.HexColor("#6b7280")
LGREY  = colors.HexColor("#f3f4f6")
LINE   = colors.HexColor("#e2e5ed")


def hrule(c, y, x1=15, x2=None, color=LINE, lw=0.5):
    x2 = x2 or (W / mm - 15)
    c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.line(x1 * mm, y, x2 * mm, y)


def draw_quote(c, job):
    line_items = job.get("line_items", [])
    gst_rate   = float(job.get("gst_rate", 0.10))

    gross    = sum(float(li["qty"]) * float(li["unit_sell"]) for li in line_items if float(li.get("unit_sell", 0)) > 0)
    gst_amt  = gross * gst_rate
    total    = gross + gst_amt

    rx = W - 15 * mm
    y  = H - 14 * mm

    # ── HEADER — company info (right) ────────────────────────────────────
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(DARK)
    c.drawRightString(rx, y, "Flooring Junction Pty Ltd")
    c.setFont("Helvetica", 8.5)
    c.setFillColor(GREY)
    for line in [
        "3/2-10 Hallam South Road, HALLAM VIC 3803",
        "P 03 9796 3255",
        "info@flooringjunction.com.au",
        "ABN 90 661 948 456",
    ]:
        y -= 5 * mm
        c.drawRightString(rx, y, line)

    y -= 8 * mm
    hrule(c, y, color=ORANGE, lw=2)
    y -= 9 * mm

    # ── QUOTE TITLE + NUMBER ─────────────────────────────────────────────
    c.setFont("Helvetica-Bold", 22)
    c.setFillColor(DARK)
    c.drawString(15 * mm, y, "Quote")
    c.setFillColor(ORANGE)
    c.drawRightString(rx, y, str(job.get("quote_number", "")))

    y -= 5 * mm
    c.setFont("Helvetica", 8)
    c.setFillColor(GREY)
    c.drawRightString(rx, y, f"Date: {job.get('quote_date', '')}")

    y -= 5 * mm
    hrule(c, y)
    y -= 8 * mm

    # ── CLIENT + SITE ────────────────────────────────────────────────────
    c.setFont("Helvetica-Bold", 9.5)
    c.setFillColor(DARK)
    c.drawString(15 * mm, y, job.get("customer_name", ""))

    c.setFont("Helvetica", 9)
    c.setFillColor(GREY)
    c.drawString(15 * mm, y - 5 * mm,  f"{job.get('customer_state','')}   {job.get('customer_country','')}")
    c.drawString(15 * mm, y - 10 * mm, job.get("customer_email", ""))

    c.setFont("Helvetica", 9)
    c.setFillColor(DARK)
    c.drawRightString(rx, y,           job.get("site_address", ""))
    c.drawRightString(rx, y - 5 * mm,  f"{job.get('site_suburb','')}  {job.get('site_state','')}")
    c.drawRightString(rx, y - 10 * mm, job.get("site_country", ""))

    y -= 17 * mm
    hrule(c, y)
    y -= 8 * mm

    # ── LINE ITEMS TABLE ─────────────────────────────────────────────────
    if line_items:
        # Table header
        c.setFillColor(LGREY)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.4)
        c.rect(15 * mm, y - 7 * mm, W - 30 * mm, 7 * mm, fill=1)

        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(GREY)
        c.drawString(18 * mm,     y - 5 * mm, "Description")
        c.drawRightString(rx - 40 * mm, y - 5 * mm, "Qty")
        c.drawRightString(rx - 20 * mm, y - 5 * mm, "Unit Sell")
        c.drawRightString(rx,           y - 5 * mm, "Total")
        y -= 7 * mm

        # Rows
        for li in line_items:
            qty       = float(li.get("qty", 0))
            unit_sell = float(li.get("unit_sell", 0))
            line_tot  = qty * unit_sell

            # Alternate row shading
            c.setFillColor(colors.HexColor("#fafafa"))
            c.setStrokeColor(LINE)
            c.setLineWidth(0.3)
            c.rect(15 * mm, y - 6 * mm, W - 30 * mm, 6 * mm, fill=1)

            c.setFont("Helvetica", 8.5)
            c.setFillColor(DARK)
            c.drawString(18 * mm,           y - 4.5 * mm, li.get("description", ""))
            c.drawRightString(rx - 40 * mm, y - 4.5 * mm, f"{qty:g}")
            c.drawRightString(rx - 20 * mm, y - 4.5 * mm, f"${unit_sell:,.2f}")
            c.drawRightString(rx,           y - 4.5 * mm, f"${line_tot:,.2f}")
            y -= 6 * mm

        y -= 4 * mm
        hrule(c, y)
        y -= 6 * mm
    else:
        # No line items — show description box instead
        desc_lines = [
            ("TO SUPPLY AND INSTALL:", True),
            ("<Timber> USING <Underlay> underlay.", False),
            ("", False),
            ("TO:", True),
            ("<Rooms>", False),
            ("", False),
            ("THIS QUOTATION INCLUDES:", True),
            ("TAKE UP AND DISPOSAL OF EXISTING CARPET.", False),
            ("BASIC FURNITURE HANDLING.", False),
        ]
        box_h = len(desc_lines) * 5 * mm + 10 * mm
        c.setFillColor(colors.white)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.rect(15 * mm, y - box_h, W - 30 * mm, box_h, fill=1)
        ty = y - 6 * mm
        for text, bold in desc_lines:
            if not text:
                ty -= 2 * mm
                continue
            c.setFont("Helvetica-Bold" if bold else "Helvetica", 8.5)
            c.setFillColor(DARK)
            c.drawString(19 * mm, ty, text)
            ty -= 5 * mm
        y = y - box_h - 5 * mm

    # ── PAYMENT TERMS ─────────────────────────────────────────────────────
    pt_h = 46 * mm
    c.setFillColor(LGREY)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.rect(15 * mm, y - pt_h, W - 30 * mm, pt_h, fill=1)

    py = y - 6 * mm
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(ORANGE)
    c.drawString(19 * mm, py, "C.O.D.")

    py -= 7 * mm
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(DARK)
    c.drawString(19 * mm, py, "PAYMENT TERMS")

    c.setFont("Helvetica", 8)
    c.setFillColor(GREY)
    for tline in [
        "Initial deposit 50%, Balance to be paid 3 working day's prior to installation.",
        "All orders $1000 or under are to be paid in full upon acceptance of quotation.",
        "Payment can be made by CASH, CHEQUE or CREDIT CARD.",
        "Alternatively, payment can be made by ELECTRONIC TRANSFER",
        "[please put job name or number as reference].",
    ]:
        py -= 4.5 * mm
        c.drawString(19 * mm, py, tline)

    py -= 7 * mm
    c.setFont("Helvetica-Bold", 9.5)
    c.setFillColor(DARK)
    c.drawString(19 * mm, py, "BSB 063 237,  ACCOUNT NO. 1048 7235")
    py -= 5.5 * mm
    c.drawString(19 * mm, py, "Account name: Flooring Junction Pty. Ltd.")

    y -= pt_h + 6 * mm

    # ── TOTALS TABLE ─────────────────────────────────────────────────────
    tot_h = 24 * mm
    divX  = W - 65 * mm

    c.setFillColor(colors.white)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.rect(15 * mm, y - tot_h, W - 30 * mm, tot_h, fill=1)
    c.line(divX, y, divX, y - tot_h)

    row_y = y - 6 * mm
    for lbl, val, big in [
        (f"Net", f"${gross:,.2f}", False),
        (f"GST  {int(gst_rate*100)}%", f"${gst_amt:,.2f}", False),
        ("Total", f"${total:,.2f}", True),
    ]:
        c.setFont("Helvetica", 9)
        c.setFillColor(GREY)
        c.drawRightString(divX - 4 * mm, row_y, lbl)
        c.setFont("Helvetica-Bold", 11 if big else 9)
        c.setFillColor(ORANGE if big else DARK)
        c.drawRightString(rx, row_y, val)
        row_y -= 6 * mm

    y -= tot_h + 6 * mm

    # ── SIGNATURE ────────────────────────────────────────────────────────
    hrule(c, y)
    y -= 6 * mm
    c.setFont("Helvetica", 8.5)
    c.setFillColor(DARK)
    c.drawString(15 * mm, y, job.get("rep_name", ""))
    y -= 4.5 * mm
    c.setFont("Helvetica", 8)
    c.setFillColor(GREY)
    c.drawString(15 * mm, y, job.get("rep_location", ""))

    # ── FOOTER — logo centred at bottom ──────────────────────────────────
    logo_h = 18 * mm
    logo_w = 32 * mm
    hrule(c, 8 * mm + logo_h + 5 * mm, color=ORANGE, lw=1.5)

    if os.path.exists(LOGO):
        logo_x = (W - logo_w) / 2
        c.drawImage(LOGO, logo_x, 8 * mm, width=logo_w, height=logo_h,
                    preserveAspectRatio=True, mask='auto')
    else:
        # Fallback text if logo file not found
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(ORANGE)
        c.drawCentredString(W / 2, 12 * mm, "Flooring Junction")

    c.save()


if __name__ == "__main__":
    raw      = sys.argv[1]
    job_data = json.loads(raw)
    out_path = job_data.get("output_path", "/tmp/quote_output.pdf")

    cv = rl_canvas.Canvas(out_path, pagesize=A4)
    draw_quote(cv, job_data)
    print(f"OK:{out_path}")
