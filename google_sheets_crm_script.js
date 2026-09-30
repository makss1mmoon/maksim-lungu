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

    // 3. ПАРСИНГ ДАННЫХ АБИТУРИЕНТА
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

    // Умный парсинг имени: если пришло только ФИО целиком (или имя пустое)
    if (!clientFirstName && clientFullName) {
      var nameParts = clientFullName.split(/\s+/);
      if (nameParts.length === 1) {
        clientFirstName = nameParts[0];
      } else if (nameParts.length >= 2) {
        if (!clientSurname) clientSurname = nameParts[0];
        clientFirstName = nameParts[1];
        if (nameParts.length >= 3 && !clientPatronymic) {
          clientPatronymic = nameParts.slice(2).join(" ");
        }
      }
    }
    if (!clientFirstName) {
      clientFirstName = clientSurname || clientFullName || "Абитуриент";
    }

    // ВАЛИДАЦИЯ: телефон — минимум 10 цифр
    var phoneDigitsOnly = String(clientPhone).replace(/\D/g, '');
    if (phoneDigitsOnly.length < 10) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "error", message: "Некорректный телефон" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Форматируем дату рождения в dd.MM.yyyy (если пришла в ISO YYYY-MM-DD)
    var formattedBirthdate = "—";
    if (clientBirthdate) {
      var parts = clientBirthdate.split("-");
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
      var sheets = ss.getSheets();
      // Если в таблице один лист и он пустой или с дефолтным именем — переименуем его
      if (sheets.length === 1 && (sheets[0].getName() === "Лист 1" || sheets[0].getName() === "Sheet1") && sheets[0].getLastRow() <= 1) {
        masterSheet = sheets[0];
        masterSheet.setName("Все Лиды");
      } else {
        masterSheet = ss.insertSheet("Все Лиды", 0);
      }
    }

    var masterHeaders = [
      "№", "Дата", "Время",
      "Фамилия", "Имя", "Отчество", "Дата рождения",
      "Телефон", "Telegram",
      "Уровень", "Вуз / Колледж", "Направление",
      "Статус заявки", "Заметки куратора"
    ];

    // Автоматическое исправление шапки: если шапки нет или в ней старые колонки (< 14)
    if (masterSheet.getLastRow() === 0 || masterSheet.getLastColumn() < 14) {
      masterSheet.getRange(1, 1, 1, 14).setValues([masterHeaders]);
      var header = masterSheet.getRange(1, 1, 1, 14);
      header.setBackground("#D9381E");
      header.setFontColor("#FFFFFF");
      header.setFontWeight("bold");
      header.setHorizontalAlignment("center");
      header.setVerticalAlignment("middle");
      masterSheet.setRowHeight(1, 36);
      masterSheet.setFrozenRows(1);
    }

    // 4. ДУБЛИКАТЫ: если тот же телефон был отправлен за последние 20 строк — помечаем заметкой
    var isDuplicate = false;
    var lastRow = masterSheet.getLastRow();
    if (lastRow > 1) {
      var recentRows = Math.min(lastRow - 1, 20);
      var recentData = masterSheet.getRange(lastRow - recentRows + 1, 8, recentRows, 1).getValues(); // Колонка H = Телефон
      var cleanNew = phoneDigitsOnly.slice(-10);
      
      for (var i = 0; i < recentData.length; i++) {
        var existing = String(recentData[i][0]).replace(/\D/g, '').slice(-10);
        if (existing && existing === cleanNew) {
          isDuplicate = true;
          break;
        }
      }
    }

    if (isDuplicate) {
      clientNotes = (clientNotes ? clientNotes + " • " : "") + "⚠️ Повторный запрос";
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
    }

    var dayHeaders = [
      "Время", "Фамилия", "Имя", "Отчество", "Дата рождения",
      "Телефон", "Telegram", "Уровень", "Вуз / Колледж", "Направление",
      "Статус", "Заметки"
    ];

    if (daySheet.getLastRow() === 0 || daySheet.getLastColumn() < 12) {
      daySheet.getRange(1, 1, 1, 12).setValues([dayHeaders]);
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
