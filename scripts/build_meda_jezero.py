"""MEDA climatology for Jezero: air temperature by local true solar time (LTST),
dust opacity and sunset time, binned by season (solar longitude Ls).

Source: Hueso, R., Munguira, A., Sanchez-Lavega, A. et al. (2024) "Derived environmental
temperatures at Jezero crater from Air Temperature Sensors' measurements on the
Perseverance rover", Zenodo doi:10.5281/zenodo.11198655 (CC BY 4.0), supporting
Munguira et al. (2024), JGR Planets. Download "Processed data for analysis.zip" and
unzip to raw/meda/.

Output: data/sites/jezero/meda.json
"""
import json, os
import numpy as np
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = os.path.join(ROOT, "raw", "meda")
OUT = os.path.join(ROOT, "data", "sites", "jezero", "meda.json")
LS_BIN = 30


def rows(path):
    wb = openpyxl.load_workbook(os.path.join(M, path), read_only=True)
    it = wb.worksheets[0].iter_rows(values_only=True)
    head = next(it)
    return head, [r for r in it if r and r[0] is not None]


def main():
    _, four = rows("Figs 4-7/Fourier_series_fit_145cm.xlsx")
    sol_ls = np.array([(r[0], r[1]) for r in four], float)
    lsu = np.unwrap(np.radians(sol_ls[:, 1])) * 180 / np.pi
    # sols past the table are mapped back one Mars year (668.6 sols), where Ls repeats
    ls_of = lambda s: np.interp(np.where(np.asarray(s) > sol_ls[-1, 0], np.asarray(s) - 668.6, s), sol_ls[:, 0], lsu) % 360

    _, ats = rows("Fig 9/ATS_DER_5mins_averages.xlsx")
    a = np.array([(r[0], r[1], r[3]) for r in ats if r[3] is not None], float)
    a_ls = ls_of(a[:, 0])
    _, op = rows("Figs 4-7/Fig4b_atmospheric_opacity_ZCAM.xlsx")
    op = np.array([(r[1], r[2]) for r in op if r[2] is not None], float)
    _, ss = rows("Fig 10/time_of_sunset_vs_sol.xlsx")
    ss = np.array([(r[0], r[1]) for r in ss if r[1] is not None], float)
    ss_ls = ls_of(ss[:, 0])

    hours = np.arange(0, 24, 0.5)
    bins = []
    for b0 in range(0, 360, LS_BIN):
        m = (a_ls >= b0) & (a_ls < b0 + LS_BIN)
        sols = np.unique(a[m, 0])
        prof = []
        for h in hours:
            mm = m & (a[:, 1] >= h) & (a[:, 1] < h + 0.5)
            v = a[mm, 2] - 273.15
            prof.append([round(float(np.mean(v)), 1), round(float(np.percentile(v, 10)), 1), round(float(np.percentile(v, 90)), 1)] if v.size > 20 else None)
        om = (op[:, 0] % 360 >= b0) & (op[:, 0] % 360 < b0 + LS_BIN)
        sm = (ss_ls >= b0) & (ss_ls < b0 + LS_BIN)
        bins.append({"ls0": b0, "ls1": b0 + LS_BIN, "n_sols": int(sols.size),
                     "temp_c_by_ltst": prof,
                     "opacity_mean": round(float(op[om, 1].mean()), 2) if om.any() else None,
                     "opacity_max": round(float(op[om, 1].max()), 2) if om.any() else None,
                     "sunset_ltst": round(float(ss[sm, 1].mean()), 2) if sm.any() else None})
        print(b0, "sols", sols.size, "opacity", bins[-1]["opacity_mean"], "sunset", bins[-1]["sunset_ltst"])
    out = {"hours_ltst": hours.tolist(), "ls_bin_deg": LS_BIN, "bins": bins,
           "variable": "Air temperature at 1.45 m (MEDA ATS, derived), mean and 10th/90th percentile of 5-min averages, deg C",
           "coverage": f"Perseverance sols {int(a[:,0].min())}-{int(a[:,0].max())} (about one Mars year)",
           "source": "Hueso et al. (2024) Zenodo doi:10.5281/zenodo.11198655, CC BY 4.0; Munguira et al. (2024) JGR Planets. Opacity: Mastcam-Z (same dataset). Sunset: same dataset (Fig. 10).",
           "caveat": "Climatology from past sols, not a forecast. The rover moved ~500 m in elevation over this period."}
    json.dump(out, open(OUT, "w"), separators=(",", ":"))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
