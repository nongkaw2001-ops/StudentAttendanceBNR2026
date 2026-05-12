(function createUi(global) {
    const STATUS_LABELS = {
        present: "มา",
        absent: "ไม่มา",
        late: "สาย"
    };

    function getElements() {
        return {
            appView: document.getElementById("appView"),
            authMessage: document.getElementById("authMessage"),
            authView: document.getElementById("authView"),
            attendanceList: document.getElementById("attendanceList"),
            absentCount: document.getElementById("absentCount"),
            classSelect: document.getElementById("classSelect"),
            currentDateLabel: document.getElementById("currentDateLabel"),
            historyClassSelect: document.getElementById("historyClassSelect"),
            historyFromDate: document.getElementById("historyFromDate"),
            historyList: document.getElementById("historyList"),
            historyPreset: document.getElementById("historyPreset"),
            historyStudentSelect: document.getElementById("historyStudentSelect"),
            historyToDate: document.getElementById("historyToDate"),
            lateCount: document.getElementById("lateCount"),
            presentCount: document.getElementById("presentCount"),
            studentCount: document.getElementById("studentCount"),
            studentList: document.getElementById("studentList"),
            totalCount: document.getElementById("totalCount"),
            userEmail: document.getElementById("userEmail"),
            userPanel: document.getElementById("userPanel")
        };
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function toArray(record) {
        return Object.entries(record || {})
            .map(([id, value]) => ({ id, ...value }))
            .sort((a, b) => (a.name || "").localeCompare(b.name || "", "th"));
    }

    function activeStudents(students) {
        return toArray(students).filter((student) => student.active !== false);
    }

    function setAuthState(user) {
        const el = getElements();
        el.authView.hidden = Boolean(user);
        el.appView.hidden = !user;
        el.userPanel.hidden = !user;
        el.userEmail.textContent = user ? user.email : "";
        setAuthMessage("");
    }

    function setRole(role) {
        const isAdmin = role === "admin";
        document.body.dataset.role = role || "teacher";
        document.querySelectorAll("[data-admin-only]").forEach((element) => {
            element.hidden = !isAdmin;
        });

        if (!isAdmin && document.getElementById("studentsSection").classList.contains("active")) {
            showSection("attendance");
        }
    }

    function setAuthMessage(message, isError = false) {
        const el = getElements();
        el.authMessage.textContent = message || "";
        el.authMessage.classList.toggle("error", Boolean(isError));
    }

    function showSection(sectionName) {
        document.querySelectorAll(".section").forEach((section) => {
            section.classList.toggle("active", section.id === `${sectionName}Section`);
        });
        document.querySelectorAll(".tab").forEach((tab) => {
            tab.classList.toggle("active", tab.dataset.section === sectionName);
        });
    }

    function renderClasses(classes, selectedClassId) {
        const el = getElements();
        const classList = toArray(classes);
        if (classList.length === 0) {
            el.classSelect.innerHTML = `<option value="">ยังไม่มีห้องเรียน</option>`;
            el.classSelect.value = "";
            return;
        }

        el.classSelect.innerHTML = classList
            .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
            .join("");
        el.classSelect.value = selectedClassId || classList[0]?.id || "";
    }

    function renderHistoryFilters(classes, selectedClassId, students, selectedStudentId) {
        const el = getElements();
        const classList = toArray(classes);
        const classOptions = [
            `<option value="all">ทุกห้อง</option>`,
            ...classList.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
        ];
        el.historyClassSelect.innerHTML = classOptions.join("");
        el.historyClassSelect.value = selectedClassId || "all";

        const studentsDisabled = !selectedClassId || selectedClassId === "all";
        const studentList = activeStudents(students);
        el.historyStudentSelect.disabled = studentsDisabled;
        el.historyStudentSelect.innerHTML = studentsDisabled
            ? `<option value="all">เลือกห้องก่อน</option>`
            : [
                `<option value="all">ทุกคนในห้อง</option>`,
                ...studentList.map((student) => `<option value="${escapeHtml(student.id)}">${escapeHtml(student.name)}</option>`)
            ].join("");
        el.historyStudentSelect.value = studentsDisabled ? "all" : selectedStudentId || "all";
    }

    function renderStudents(students) {
        const el = getElements();
        const list = activeStudents(students);
        el.studentCount.textContent = list.length;

        if (list.length === 0) {
            el.studentList.innerHTML = `<li class="empty-state">ยังไม่มีนักเรียนในห้องนี้</li>`;
            return;
        }

        el.studentList.innerHTML = list.map((student) => `
            <li class="student-item">
                <div>
                    <div class="student-name">${escapeHtml(student.name)}</div>
                    <div class="student-meta">รหัส: ${escapeHtml(student.id)}</div>
                </div>
                <button class="button button-danger" data-action="archive-student" data-student-id="${escapeHtml(student.id)}" type="button">นำออก</button>
            </li>
        `).join("");
    }

    function renderAttendance(students, attendance) {
        const el = getElements();
        const list = activeStudents(students);
        const counts = { present: 0, absent: 0, late: 0 };

        list.forEach((student) => {
            const status = attendance?.[student.id]?.status;
            if (counts[status] !== undefined) counts[status] += 1;
        });

        el.totalCount.textContent = list.length;
        el.presentCount.textContent = counts.present;
        el.absentCount.textContent = counts.absent;
        el.lateCount.textContent = counts.late;

        if (list.length === 0) {
            el.attendanceList.innerHTML = `<li class="empty-state">ยังไม่มีนักเรียนหรือยังไม่ได้เลือกห้องเรียน</li>`;
            return;
        }

        el.attendanceList.innerHTML = list.map((student) => {
            const status = attendance?.[student.id]?.status || "";
            return `
                <li class="student-item">
                    <span class="student-name">${escapeHtml(student.name)}</span>
                    <div class="status-buttons">
                        ${renderStatusButton(student.id, "present", status)}
                        ${renderStatusButton(student.id, "absent", status)}
                        ${renderStatusButton(student.id, "late", status)}
                    </div>
                </li>
            `;
        }).join("");
    }

    function renderStatusButton(studentId, value, currentStatus) {
        const active = value === currentStatus ? "active" : "";
        return `<button class="status-btn ${value} ${active}" data-action="set-attendance" data-student-id="${escapeHtml(studentId)}" data-status="${value}" type="button">${STATUS_LABELS[value]}</button>`;
    }

    function renderAnalytics(report) {
        const el = getElements();
        if (!report || report.classSummaries.length === 0) {
            el.historyList.innerHTML = `<div class="empty-state">ยังไม่มีข้อมูลสำหรับช่วงเวลานี้</div>`;
            return;
        }

        el.historyList.innerHTML = `
            <div class="analytics-header">
                <div>
                    <p class="eyebrow dark">Attendance Analytics</p>
                    <h3>${escapeHtml(report.title)}</h3>
                    <p>${escapeHtml(report.rangeLabel)} · ${report.dateKeys.length} วัน</p>
                </div>
                <div class="rate-badge">มาเฉลี่ย ${report.totals.presentRate}%</div>
            </div>

            <div class="summary-grid analytics-summary">
                ${renderMetric("วันนักเรียน", report.totals.possible, "")}
                ${renderMetric("มา", report.totals.present, "present")}
                ${renderMetric("ไม่มา", report.totals.absent, "absent")}
                ${renderMetric("สาย", report.totals.late, "late")}
                ${renderMetric("ยังไม่เช็ค", report.totals.unmarked, "")}
            </div>

            <div class="history-card">
                <div class="history-title">ภาพรวมแยกห้อง</div>
                <div class="table-wrap">
                    <table class="analytics-table">
                        <thead>
                            <tr>
                                <th>ห้อง</th>
                                <th>นักเรียน</th>
                                <th>มา</th>
                                <th>ไม่มา</th>
                                <th>สาย</th>
                                <th>ยังไม่เช็ค</th>
                                <th>% มา</th>
                            </tr>
                        </thead>
                        <tbody>${report.classSummaries.map(renderClassSummaryRow).join("")}</tbody>
                    </table>
                </div>
            </div>

            ${report.matrix ? renderMatrix(report.matrix) : ""}
            ${report.individual ? renderIndividual(report.individual) : ""}
        `;
    }

    function renderMetric(label, value, tone) {
        return `
            <article class="summary-item ${tone}">
                <strong>${escapeHtml(value)}</strong>
                <span>${escapeHtml(label)}</span>
            </article>
        `;
    }

    function renderClassSummaryRow(item) {
        return `
            <tr>
                <td><strong>${escapeHtml(item.name)}</strong></td>
                <td>${item.studentCount}</td>
                <td class="present-text">${item.present}</td>
                <td class="absent-text">${item.absent}</td>
                <td class="late-text">${item.late}</td>
                <td>${item.unmarked}</td>
                <td><span class="rate-pill">${item.presentRate}%</span></td>
            </tr>
        `;
    }

    function renderMatrix(matrix) {
        if (matrix.rows.length === 0) {
            return `<div class="empty-state">ยังไม่มีนักเรียนในห้องที่เลือก</div>`;
        }

        return `
            <div class="history-card">
                <div class="history-title">ตารางรายคน: ${escapeHtml(matrix.className)}</div>
                <div class="legend-row">
                    <span><i class="dot present"></i> มา</span>
                    <span><i class="dot absent"></i> ไม่มา</span>
                    <span><i class="dot late"></i> สาย</span>
                    <span><i class="dot unmarked"></i> ยังไม่เช็ค</span>
                </div>
                <div class="table-wrap matrix-wrap">
                    <table class="analytics-table matrix-table">
                        <thead>
                            <tr>
                                <th class="sticky-name">ชื่อ-นามสกุล</th>
                                ${matrix.dateKeys.map((key) => `<th>${escapeHtml(formatDay(key))}</th>`).join("")}
                                <th>มา/เต็ม</th>
                                <th>%</th>
                            </tr>
                        </thead>
                        <tbody>${matrix.rows.map(renderMatrixRow).join("")}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function renderMatrixRow(row) {
        return `
            <tr>
                <td class="sticky-name"><strong>${escapeHtml(row.name)}</strong></td>
                ${row.cells.map((cell) => `<td class="status-cell ${cell.status || "unmarked"}">${escapeHtml(cell.symbol)}</td>`).join("")}
                <td><strong>${row.present}/${row.totalDays}</strong></td>
                <td><span class="rate-pill">${row.presentRate}%</span></td>
            </tr>
        `;
    }

    function renderIndividual(individual) {
        return `
            <div class="history-card individual-card">
                <div class="history-title">รายบุคคล: ${escapeHtml(individual.name)}</div>
                <div class="mini-stats">
                    <span>มา ${individual.present}</span>
                    <span>ไม่มา ${individual.absent}</span>
                    <span>สาย ${individual.late}</span>
                    <span>ยังไม่เช็ค ${individual.unmarked}</span>
                    <span>อัตรามา ${individual.presentRate}%</span>
                </div>
                <div class="timeline-list">
                    ${individual.days.map((day) => `
                        <div class="timeline-item ${day.status || "unmarked"}">
                            <span>${escapeHtml(day.label)}</span>
                            <strong>${escapeHtml(day.statusLabel)}</strong>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }

    function formatDay(dateKey) {
        const [, , day] = dateKey.split("-");
        return String(Number(day));
    }

    function setDateLabel(label) {
        getElements().currentDateLabel.textContent = label;
    }

    global.AppUi = {
        getElements,
        renderAttendance,
        renderAnalytics,
        renderClasses,
        renderHistoryFilters,
        renderStudents,
        setAuthMessage,
        setAuthState,
        setRole,
        setDateLabel,
        showSection
    };
})(window);
