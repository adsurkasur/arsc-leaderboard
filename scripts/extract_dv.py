import openpyxl

wb = openpyxl.load_workbook(r'..\Rapor-ARSC-2025-2026\workbook\input\Master_Rapor_ARSC_2025_2026_FINAL.xlsx', read_only=True, data_only=True)
ws = wb['Parameter']

# Assuming achievements are listed vertically somewhere. Let's just print all rows in Parameter sheet.
for row in ws.iter_rows(values_only=True):
    # filter out rows that are entirely None
    if any(row):
        print(row)
