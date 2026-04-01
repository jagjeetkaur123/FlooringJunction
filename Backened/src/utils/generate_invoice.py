"""
src/utils/generate_invoice.py

Generates a professional Tax Invoice PDF for Flooring Junction.
Called by invoicePdRoute.js (and documentRoutes.js) via python-shell.

Receives one JSON argument: the invoice data dict.
Writes a PDF to data['output_path'] and prints "OK:<path>" on success.

Install: pip install reportlab
"""

import sys
import json
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas

LOGO  = os.path.join(os.path.dirname(__file__), "logo.png")
W, H  = A4

ORANGE = colors.HexColor("#E87722")
DARK   = colors.HexColor("#1a1d2e")
GREY   = colors.HexColor("#6b7280")
LGREY  = colors.HexColor("#f3f4f6")
LINE   = colors.HexColor("#e2e5ed")
GREEN  = colors.HexColor("#16a34a")
RED    = colors.HexColor("#dc2626")


def hrule(c, y, x1=15, x2=None, color=LINE, lw=0.5):
    x2 = x2 or (W / mm - 15)
    c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.line(x1 * mm, y, x2 * mm, y)


def cell(c, text, x, y, font="Helvetica", size=8.5, color=DARK, align="left"):
    c.setFont(font, size)
    c.setFillColor(color)
    if align == "right":
        c.drawRightString(x, y, str(text))
    elif align == "center":
        c.drawCentredString(x, y, str(text))
    else:
        c.drawString(x, y, str(text))


def draw_invoice(c, inv):
    line_items = inv.get("line_items", [])
    payments   = inv.get("payments",   [])
    gst_rate   = float(inv.get("gst_rate", 0.10))

    gross_amount      = float(inv.get("gross_amount",      0))
    credit            = float(inv.get("credit",            0))
    retention_release = float(inv.get("retention_release", 0))
    tax_amount        = float(inv.get("tax_amount",        0))
    total_amount      = float(inv.get("total_amount",      0))
    total_paid        = float(inv.get("total_paid",        0))
    balance_due       = float(inv.get("balance_due",       total_amount - total_paid))

    rx = W - 15 * mm
    y  = H - 14 * mm

    # ── COMPANY HEADER (right) ────────────────────────────────────────────
    cell(c, "Flooring Junction Pty Ltd", rx, y, "Helvetica-Bold", 10, DARK, "right")
    for line in [
        "3/2-10 Hallam South Road, HALLAM VIC 3803",
        "P 03 9796 3255",
        "info@flooringjunction.com.au",
        f"ABN  {inv.get('abn', '90 661 948 456')}",
    ]:
        y -= 5 * mm
        cell(c, line, rx, y, "Helvetica", 8.5, GREY, "right")

    y -= 8 * mm
    hrule(c, y, color=ORANGE, lw=2)
    y -= 9 * mm

    # ── TITLE + INVOICE NUMBER ────────────────────────────────────────────
    cell(c, "Tax Invoice", 15 * mm, y, "Helvetica-Bold", 22, DARK)
    cell(c, inv.get("invoice_number", ""), rx, y, "Helvetica-Bold", 13, ORANGE, "right")

    y -= 5 * mm
    cell(c, f"Date:  {inv.get('invoice_date', '')}",      rx, y, "Helvetica", 8, GREY, "right")
    y -= 4.5 * mm
    due = inv.get("due_date", "")
    if due:
        cell(c, f"Due:   {due}", rx, y, "Helvetica", 8, GREY, "right")
        y -= 4.5 * mm

    hrule(c, y)
    y -= 8 * mm

    # ── BILL TO (left)  /  SITE ADDRESS (right) ───────────────────────────
    lx = 15 * mm
    cell(c, "BILL TO",    lx,      y, "Helvetica-Bold", 7.5, GREY)
    cell(c, "SITE",       rx - 55 * mm, y, "Helvetica-Bold", 7.5, GREY)
    y -= 5 * mm

    cell(c, inv.get("customer_name", ""),      lx,           y, "Helvetica-Bold", 9.5, DARK)
    cell(c, inv.get("site_street",   ""),      rx - 55 * mm, y, "Helvetica", 9, DARK)
    y -= 5 * mm

    for left, right in [
        (inv.get("billing_street", ""),  f"{inv.get('site_town','')}  {inv.get('site_state','')}  {inv.get('site_zip','')}"),
        (f"{inv.get('billing_town','')}  {inv.get('billing_state','')}  {inv.get('billing_zip','')}", ""),
        (inv.get("billing_country", ""), ""),
    ]:
        cell(c, left,  lx,           y, "Helvetica", 8.5, GREY)
        if right:
            cell(c, right, rx - 55 * mm, y, "Helvetica", 8.5, GREY)
        y -= 4.5 * mm

    y -= 2 * mm
    # Contact + job ref
    if inv.get("contact_phone") or inv.get("contact_email"):
        cell(c, f"P  {inv.get('contact_phone','')}   E  {inv.get('contact_email','')}",
             lx, y, "Helvetica", 8, GREY)
        y -= 4.5 * mm
    if inv.get("job_ref"):
        cell(c, f"Job Ref:  {inv['job_ref']}", lx, y, "Helvetica", 8, GREY)
        y -= 4.5 * mm

    y -= 4 * mm
    hrule(c, y)
    y -= 8 * mm

    # ── LINE ITEMS TABLE ──────────────────────────────────────────────────
    if line_items:
        # Header row
        c.setFillColor(LGREY)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.4)
        c.rect(15 * mm, y - 7 * mm, W - 30 * mm, 7 * mm, fill=1)

        cell(c, "Description",  18 * mm,      y - 5 * mm, "Helvetica-Bold", 8, GREY)
        cell(c, "Qty",          rx - 40 * mm, y - 5 * mm, "Helvetica-Bold", 8, GREY, "right")
        cell(c, "Unit Price",   rx - 20 * mm, y - 5 * mm, "Helvetica-Bold", 8, GREY, "right")
        cell(c, "Amount",       rx,            y - 5 * mm, "Helvetica-Bold", 8, GREY, "right")
        y -= 7 * mm

        for li in line_items:
            is_header = li.get("is_header", False)
            qty       = float(li.get("qty",       0))
            unit_sell = float(li.get("unit_sell", 0))
            line_tot  = qty * unit_sell

            if is_header:
                c.setFillColor(colors.HexColor("#eff0f4"))
                c.setStrokeColor(LINE)
                c.setLineWidth(0.3)
                c.rect(15 * mm, y - 6 * mm, W - 30 * mm, 6 * mm, fill=1)
                cell(c, li.get("description", ""), 18 * mm, y - 4.5 * mm,
                     "Helvetica-Bold", 8.5, DARK)
            else:
                c.setFillColor(colors.HexColor("#fafafa"))
                c.setStrokeColor(LINE)
                c.setLineWidth(0.3)
                c.rect(15 * mm, y - 6 * mm, W - 30 * mm, 6 * mm, fill=1)
                cell(c, li.get("description", ""),  18 * mm,      y - 4.5 * mm, "Helvetica", 8.5, DARK)
                cell(c, f"{qty:g}",                 rx - 40 * mm, y - 4.5 * mm, "Helvetica", 8.5, DARK, "right")
                cell(c, f"${unit_sell:,.2f}",       rx - 20 * mm, y - 4.5 * mm, "Helvetica", 8.5, DARK, "right")
                cell(c, f"${line_tot:,.2f}",        rx,           y - 4.5 * mm, "Helvetica", 8.5, DARK, "right")
            y -= 6 * mm

        y -= 4 * mm
        hrule(c, y)
        y -= 6 * mm

    # ── INVOICE TOTALS ────────────────────────────────────────────────────
    tot_rows = [
        ("Net Amount",          f"${gross_amount:,.2f}",     False, DARK),
    ]
    if credit > 0:
        tot_rows.append(("Credit Applied",    f"(${credit:,.2f})",          False, GREEN))
    if retention_release > 0:
        tot_rows.append(("Retention Release", f"${retention_release:,.2f}", False, DARK))
    tot_rows += [
        (f"GST  {int(gst_rate * 100)}%",  f"${tax_amount:,.2f}",   False, DARK),
        ("Total",                          f"${total_amount:,.2f}", True,  ORANGE),
    ]

    tot_h = len(tot_rows) * 6 * mm + 4 * mm
    divX  = W - 65 * mm
    c.setFillColor(colors.white)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.rect(15 * mm, y - tot_h, W - 30 * mm, tot_h, fill=1)
    c.line(divX, y, divX, y - tot_h)

    row_y = y - 6 * mm
    for lbl, val, big, val_color in tot_rows:
        cell(c, lbl, divX - 4 * mm, row_y, "Helvetica", 9,  GREY,      "right")
        cell(c, val, rx,            row_y, "Helvetica-Bold" if big else "Helvetica",
             11 if big else 9, val_color, "right")
        row_y -= 6 * mm

    y -= tot_h + 6 * mm

    # ── PAYMENTS RECEIVED ─────────────────────────────────────────────────
    if payments:
        cell(c, "PAYMENTS RECEIVED", 15 * mm, y, "Helvetica-Bold", 9, DARK)
        y -= 6 * mm

        # Payment table header
        c.setFillColor(LGREY)
        c.rect(15 * mm, y - 6 * mm, W - 30 * mm, 6 * mm, fill=1)
        cell(c, "Date",      18 * mm,      y - 4.5 * mm, "Helvetica-Bold", 8, GREY)
        cell(c, "Method",    rx - 70 * mm, y - 4.5 * mm, "Helvetica-Bold", 8, GREY)
        cell(c, "Reference", rx - 35 * mm, y - 4.5 * mm, "Helvetica-Bold", 8, GREY)
        cell(c, "Amount",    rx,           y - 4.5 * mm, "Helvetica-Bold", 8, GREY, "right")
        y -= 6 * mm

        for p in payments:
            c.setFillColor(colors.HexColor("#f0fdf4"))
            c.setStrokeColor(LINE)
            c.setLineWidth(0.3)
            c.rect(15 * mm, y - 6 * mm, W - 30 * mm, 6 * mm, fill=1)
            method_label = {
                "cash": "Cash", "cheque": "Cheque",
                "credit_card": "Credit Card", "eftpos": "EFTPOS",
                "bank_transfer": "Bank Transfer",
            }.get(p.get("method", ""), p.get("method", ""))
            cell(c, p.get("paid_on",   ""),         18 * mm,      y - 4.5 * mm, "Helvetica", 8.5, DARK)
            cell(c, method_label,                   rx - 70 * mm, y - 4.5 * mm, "Helvetica", 8.5, DARK)
            cell(c, p.get("reference", ""),         rx - 35 * mm, y - 4.5 * mm, "Helvetica", 8.5, GREY)
            cell(c, f"${float(p['amount']):,.2f}",  rx,           y - 4.5 * mm, "Helvetica", 8.5, GREEN, "right")
            y -= 6 * mm

        y -= 4 * mm
        hrule(c, y)
        y -= 6 * mm

    # ── BALANCE DUE ───────────────────────────────────────────────────────
    bal_color = RED if balance_due > 0.005 else GREEN
    bal_label = "BALANCE DUE" if balance_due > 0.005 else "PAID IN FULL"
    c.setFillColor(LGREY if balance_due > 0.005 else colors.HexColor("#f0fdf4"))
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.rect(15 * mm, y - 10 * mm, W - 30 * mm, 10 * mm, fill=1)
    cell(c, bal_label,                    divX - 4 * mm, y - 7 * mm, "Helvetica-Bold", 9.5, bal_color, "right")
    cell(c, f"${balance_due:,.2f}",       rx,            y - 7 * mm, "Helvetica-Bold", 13,  bal_color, "right")
    y -= 10 * mm + 8 * mm

    # ── BANK TRANSFER DETAILS ─────────────────────────────────────────────
    pt_h = 22 * mm
    c.setFillColor(LGREY)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.rect(15 * mm, y - pt_h, W - 30 * mm, pt_h, fill=1)

    py = y - 6 * mm
    cell(c, "PAYMENT DETAILS", 19 * mm, py, "Helvetica-Bold", 9, ORANGE)
    py -= 5.5 * mm
    for line in [
        "BSB 063 237   |   Account No. 1048 7235   |   Account Name: Flooring Junction Pty. Ltd.",
        "Payment by CASH, CHEQUE, CREDIT CARD or ELECTRONIC TRANSFER.",
        "Please use invoice number as your payment reference.",
    ]:
        cell(c, line, 19 * mm, py, "Helvetica", 8, GREY)
        py -= 4.5 * mm

    y -= pt_h + 6 * mm

    # ── THANK YOU NOTE ────────────────────────────────────────────────────
    cell(c, "Thank you for your business!", 15 * mm, y, "Helvetica", 9, GREY)

    # ── FOOTER — logo centred at bottom ──────────────────────────────────
    logo_h = 18 * mm
    logo_w = 32 * mm
    hrule(c, 8 * mm + logo_h + 5 * mm, color=ORANGE, lw=1.5)

    if os.path.exists(LOGO):
        logo_x = (W - logo_w) / 2
        c.drawImage(LOGO, logo_x, 8 * mm, width=logo_w, height=logo_h,
                    preserveAspectRatio=True, mask='auto')
    else:
        cell(c, "Flooring Junction", W / 2, 12 * mm, "Helvetica-Bold", 10, ORANGE, "center")

    c.save()


if __name__ == "__main__":
    raw      = sys.argv[1]
    inv_data = json.loads(raw)
    out_path = inv_data.get("output_path", "/tmp/invoice_output.pdf")

    cv = rl_canvas.Canvas(out_path, pagesize=A4)
    draw_invoice(cv, inv_data)
    print(f"OK:{out_path}")
