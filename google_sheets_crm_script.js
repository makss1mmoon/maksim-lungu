function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Предотвращаем конфликты при одновременных заявках

  try {
    var contents = (e && e.postData) ? e.postData.contents : "{}";
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ========================================================================
    // СЕРВЕРНАЯ АНТИ-БОТ ЗАЩИТА
    // ========================================================================

    // 1. HONEYPOT: если скрытое поле заполнено — это бот
    if (data._hp && String(data._hp).trim().length > 0) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "success", row: -1 }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. TIME-TRAP: если форма заполнена быстрее 2 секунд — бот
    if (data._ft) {
      var formOpenTime = parseInt(data._ft, 10);
      var serverNow = new Date().getTime();
      var elapsedMs = serverNow - formOpenTime;
      if (elapsedMs > 0 && elapsedMs < 2000) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: "success", row: -1 }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ========================================================================
    // ПАРСИНГ ДАННЫХ АБИТУРИЕНТА
    // ========================================================================
    var clientFullName = (data.name || "").trim();
    var clientSurname = (data.surname || "").trim();
    var clientFirstName = (data.firstName || "").trim();
    var clientPatronymic = (data.patronymic || "").trim();
    var clientBirthdate = (data.birthdate || "").trim(); // формат YYYY-MM-DD
    var clientPhone = (data.phone || "").trim();
    var clientTelegram = (data.telegram || "").trim();
    var clientLevel = (data.level || "Вуз (Бакалавриат)").trim();
    var clientInstitution = (data.institution || "«Синергия»").trim();
    var clientFaculty = (data.faculty || "IT, разработка и ИИ").trim();
    var clientNotes = data.notes || "";

    // 3. ВАЛИДАЦИЯ: имя должно содержать только буквы (2-60 символов)
    var nameRegex = /^[a-zA-Zа-яА-ЯёЁ\s\-]{2,60}$/;
    if (!clientFirstName || !nameRegex.test(clientFirstName)) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "error", message: "Некорректное имя" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. ВАЛИДАЦИЯ: телефон — 10-15 цифр
    var phoneDigitsOnly = String(clientPhone).replace(/\D/g, '');
    if (phoneDigitsOnly.length < 10 || phoneDigitsOnly.length > 15) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "error", message: "Некорректный телефон" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Форматируем дату рождения в dd.MM.yyyy (если пришла в ISO)
    var formattedBirthdate = "—";
    if (clientBirthdate) {
      var parts = clientBirthdate.split("-"); // YYYY-MM-DD
      if (parts.length === 3) {
        formattedBirthdate = parts[2] + "." + parts[1] + "." + parts[0];
      } else {
        formattedBirthdate = clientBirthdate;
      }
    }

    // Московское время
    var now = new Date();
    var dateStr = Utilities.formatDate(now, "Europe/Moscow", "dd.MM.yyyy");
    var timeStr = Utilities.formatDate(now, "Europe/Moscow", "HH:mm:ss");

    // Telegram с @
    var telegramDisplay = clientTelegram ? ("@" + clientTelegram.replace(/^@/, '')) : "—";

    // ------------------------------------------------------------------------
    // ЛИСТ 1: «Все Лиды» (Главная сводная база)
    // ------------------------------------------------------------------------
    var masterSheet = ss.getSheetByName("Все Лиды");
    if (!masterSheet) {
      masterSheet = ss.insertSheet("Все Лиды", 0);
      masterSheet.appendRow([
        "№", "Дата", "Время",
        "Фамилия", "Имя", "Отчество", "Дата рождения",
        "Телефон", "Telegram",
        "Уровень", "Вуз / Колледж", "Направление",
        "Статус заявки", "Заметки куратора"
      ]);
      
      var header = masterSheet.getRange(1, 1, 1, 14);
      header.setBackground("#D9381E");
      header.setFontColor("#FFFFFF");
      header.setFontWeight("bold");
      header.setHorizontalAlignment("center");
      header.setVerticalAlignment("middle");
      masterSheet.setRowHeight(1, 36);
      masterSheet.setFrozenRows(1);
    }

    // 5. ДУБЛИКАТЫ: блокируем повторную заявку с тем же телефоном (последние 20 записей)
    var lastRow = masterSheet.getLastRow();
    if (lastRow > 1) {
      var recentRows = Math.min(lastRow - 1, 20);
      var recentData = masterSheet.getRange(lastRow - recentRows + 1, 8, recentRows, 1).getValues(); // Колонка H = Телефон
      var normalizedNewPhone = "'8" + phoneDigitsOnly.slice(phoneDigitsOnly.length - 10);
      
      for (var i = 0; i < recentData.length; i++) {
        var existingPhone = String(recentData[i][0]).replace(/\D/g, '');
        var newClean = normalizedNewPhone.replace(/\D/g, '');
        if (existingPhone === newClean && existingPhone.length >= 10) {
          return ContentService
            .createTextOutput(JSON.stringify({ status: "success", row: -1, note: "duplicate" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    var nextId = Math.max(1, masterSheet.getLastRow());

    // Форматируем телефон: 8XXXXXXXXXX
    var digits = String(clientPhone || "").replace(/\D/g, '');
    var safePhone = "—";
    if (digits.length === 11) {
      safePhone = "'8" + digits.slice(1);
    } else if (digits.length === 10) {
      safePhone = "'8" + digits;
    } else if (digits.length > 0) {
      safePhone = "'8" + digits;
    }

    var masterRow = [
      nextId,
      dateStr,
      timeStr,
      clientSurname || "—",
      clientFirstName || "Без имени",
      clientPatronymic || "—",
      formattedBirthdate,
      safePhone,
      telegramDisplay,
      clientLevel,
      clientInstitution,
      clientFaculty,
      "🔥 Новый",
      clientNotes
    ];

    masterSheet.appendRow(masterRow);

    // Выпадающий список статусов (Колонка M / 13)
    var newRowIndex = masterSheet.getLastRow();
    var statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList([
        "🔥 Новый", 
        "📞 Взят в работу", 
        "⏳ Думает / Перезвонить", 
        "📄 Документы поданы", 
        "🎓 Зачислен", 
        "❌ Нецелевой / Отказ"
      ], true)
      .build();
    masterSheet.getRange(newRowIndex, 13).setDataValidation(statusRule);

    // ------------------------------------------------------------------------
    // ЛИСТ 2: Ежедневный срез (Лист с именем даты)
    // ------------------------------------------------------------------------
    var daySheetName = dateStr;
    var daySheet = ss.getSheetByName(daySheetName);
    if (!daySheet) {
      daySheet = ss.insertSheet(daySheetName, 1);
      daySheet.appendRow([
        "Время", "Фамилия", "Имя", "Отчество", "Дата рождения",
        "Телефон", "Telegram", "Уровень", "Вуз / Колледж", "Направление",
        "Статус", "Заметки"
      ]);
      
      var dayHeader = daySheet.getRange(1, 1, 1, 12);
      dayHeader.setBackground("#222222");
      dayHeader.setFontColor("#FFFFFF");
      dayHeader.setFontWeight("bold");
      dayHeader.setHorizontalAlignment("center");
      dayHeader.setVerticalAlignment("middle");
      daySheet.setRowHeight(1, 32);
      daySheet.setFrozenRows(1);
    }

    var dayRow = [
      timeStr,
      clientSurname || "—",
      clientFirstName || "Без имени",
      clientPatronymic || "—",
      formattedBirthdate,
      safePhone,
      telegramDisplay,
      clientLevel,
      clientInstitution,
      clientFaculty,
      "🔥 Новый",
      clientNotes
    ];
    daySheet.appendRow(dayRow);
    daySheet.getRange(daySheet.getLastRow(), 11).setDataValidation(statusRule);

    // Автоподбор ширины столбцов
    try {
      masterSheet.autoResizeColumns(1, 14);
      daySheet.autoResizeColumns(1, 12);
    } catch(e) {}

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", row: newRowIndex }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput("✅ CRM Webhook Синергия / МТИ / МАП работает! (с анти-бот защитой)");
}
