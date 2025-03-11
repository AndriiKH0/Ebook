package com.example.FbReaderWeb.service;
import com.example.FbReaderWeb.model.User;
import com.example.FbReaderWeb.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;

import com.example.FbReaderWeb.model.Ebook;
import com.example.FbReaderWeb.repository.EbookRepository;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.mozilla.universalchardet.UniversalDetector;
import java.awt.Image;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;



@Service
public class Fb2Service {

    private final EbookRepository ebookRepository;
    private final UserRepository userRepository;
    private static final Logger logger = LoggerFactory.getLogger(Fb2Service.class);
    @Autowired
    public Fb2Service(EbookRepository ebookRepository, UserRepository userRepository) {
        this.ebookRepository = ebookRepository;
        this.userRepository = userRepository;
    }




    public void extractAndSaveImagesAsync(String content, String outputDir, String bookId) {
        extractAndSaveImages(content, outputDir, bookId);
    }


    public List<Ebook> searchByTitle(String query) {
        return ebookRepository.findByTitleContainingIgnoreCase(query);
    }

    public List<Ebook> searchByAuthor(String query) {
        return ebookRepository.findByAuthorContainingIgnoreCase(query);
    }

    public List<Ebook> searchByGenre(String genre, String username) {
        return ebookRepository.findByUserAndGenreContainingIgnoreCase(username, genre);
    }



    public String processFb2File(MultipartFile file, String username) throws IOException {

        String bookId = UUID.randomUUID().toString();


        Path tempDir = Files.createTempDirectory("fb2_temp");


        String outputDir = new File("src/main/resources/static/images").getAbsolutePath() + File.separator;


        File tempFile = new File(tempDir.toString(), "temp.fb2");
        file.transferTo(tempFile);


        String charset = detectCharset(tempFile.getAbsolutePath());
        String content = readText(tempFile.getAbsolutePath(), charset);


        String title = extractTagContent(content, "<book-title>", "</book-title>");
        title = title != null ? stripTags(title) : "Неизвестное название";

        String author = extractAuthor(content);


        String parsedContent = parseFb2(content, outputDir, bookId);
        parsedContent = flattenTextWithTags(parsedContent);
        parsedContent = cleanHtmlTags(parsedContent);
        parsedContent = mergeBrokenText(parsedContent);

        List<String> genres = extractGenres(content);
        List<String> uniqueGenres = genres.stream().distinct().collect(Collectors.toList());


        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        Ebook ebook = saveEbookToDatabase(title, author, parsedContent, bookId);
        ebook.setGenres(uniqueGenres);
        ebook.setUser(user);
        ebookRepository.save(ebook);


        extractAndSaveImagesAsync(content, outputDir, bookId);


        Files.walk(tempDir).sorted(Comparator.reverseOrder()).map(Path::toFile).forEach(File::delete);

        return ebook.getId().toString();
    }

    private String parseFb2(String content, String outputDir, String bookId) {
        extractAndSaveCoverImage(content, outputDir, bookId);
        extractAndSaveImages(content, outputDir, bookId);

        String title = extractTagContent(content, "<book-title>", "</book-title>");
        title = (title != null) ? title.trim() : "Без названия";

        String authorTag = extractTagContent(content, "<author>", "</author>");
        String firstName = (authorTag != null) ? extractTagContent(authorTag, "<first-name>", "</first-name>") : "";
        String lastName = (authorTag != null) ? extractTagContent(authorTag, "<last-name>", "</last-name>") : "";
        String author = ((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim();
        if (author.isEmpty()) {
            author = "Неизвестный автор";
        }

        StringBuilder result = new StringBuilder();


        result.append("<div class='cover-page'>")
                .append("<img src='/images/").append(bookId).append("_cover.jpg' alt='Обложка' class='cover-image'>")
                .append("<h1 class='book-title'>").append(title).append("</h1>")
                .append("<h2 class='book-author'>").append(author).append("</h2>")
                .append("</div>");


        String body = extractTagContent(content, "<body>", "</body>");
        if (body != null) {
            body = body.replaceAll("(?i)<title>\\s*<p>(.*?)</p>\\s*</title>", "<h3 style=\"text-align: center;\">$1</h3>");
            body = body.replaceAll("<image\\s+xlink:href=\"#(.*?)\"\\s*/?>",
                    "<img src=\"/images/" + bookId + "_$1.jpg\" style=\"max-width: 100%; height: auto;\">");
            body = body.replaceAll("__+", "_");


            result.append("<div class='page' id='firstPage'>").append(body).append("</div>");
        }

        return result.toString();
    }



    private Ebook saveEbookToDatabase(String title, String author, String content, String bookId) {
        Ebook ebook = new Ebook();
        ebook.setTitle(title);
        ebook.setAuthor(author);
        ebook.setContent(content);
        if (bookId != null && !bookId.isEmpty()) {
            ebook.setCoverFilename(bookId + "_cover.jpg");
        }
        return ebookRepository.save(ebook);
    }


    private String detectCharset(String filePath) {
        try (InputStream inputStream = new FileInputStream(filePath)) {
            byte[] bytes = new byte[4096];
            UniversalDetector detector = new UniversalDetector(null);
            int nread;
            while ((nread = inputStream.read(bytes)) > 0 && !detector.isDone()) {
                detector.handleData(bytes, 0, nread);
            }
            detector.dataEnd();
            return detector.getDetectedCharset();
        } catch (IOException e) {
            e.printStackTrace();
        }
        return null;
    }
    public int getTotalPages(String content, int wordsPerScreen, boolean twoPageMode) {
        List<String> pages = twoPageMode
                ? paginateTwoPageMode(content, wordsPerScreen)
                : paginateContent(content, wordsPerScreen, twoPageMode);
        return pages.size();
    }
    private String readText(String filePath, String charset) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(filePath), charset))) {
            StringBuilder builder = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line).append("\n");
            }
            return builder.toString();
        } catch (IOException e) {
            e.printStackTrace();
        }
        return null;
    }









    private String flattenTextWithTags(String content) {
        return content.replaceAll("<emphasis>(.*?)</emphasis>", "<em>$1</em>");
    }
    private String cleanHtmlTags(String content) {

        content = content.replaceAll("<span>(\\s*)<span>", "<span>");
        content = content.replaceAll("</span>(\\s*)</span>", "</span>");


        content = content.replaceAll("<emphasis>(.*?)</emphasis>", "<span style=\"font-style:italic\">$1</span>");
        content = content.replaceAll("<em>(.*?)</em>", "<span style=\"font-style:italic\">$1</span>");

        return content;
    }

    private String mergeBrokenText(String content) {

        content = content.replaceAll("(</em>)(\\s*)(<em>)", "");
        content = content.replaceAll("(</span>)(\\s*)(<span>)", "");


        content = content.replaceAll("\\s+</span>", "</span>");
        content = content.replaceAll("<span>\\s+", "<span>");

        return content;
    }




    private String extractAuthor(String content) {
        String authorTag = extractTagContent(content, "<author>", "</author>");
        if (authorTag == null) return "Неизвестный автор";

        String firstName = extractTagContent(authorTag, "<first-name>", "</first-name>");
        String lastName = extractTagContent(authorTag, "<last-name>", "</last-name>");

        firstName = firstName != null ? firstName : "";
        lastName = lastName != null ? lastName : "";

        return (firstName + " " + lastName).trim();
    }

    private String extractTagContent(String content, String startTag, String endTag) {
        int start = content.indexOf(startTag);
        if (start == -1) {
            System.err.println("Тег " + startTag + " не найден!");
            return "";
        }

        int end = content.indexOf(endTag, start + startTag.length());
        if (end == -1) {
            System.err.println("Тег " + endTag + " не найден!");
            return "";
        }


        return content.substring(start + startTag.length(), end).trim();
    }



    private String stripTags(String input) {
        return input.replaceAll("<[^>]+>", "").trim();
    }

    private void extractAndSaveCoverImage(String content, String outputDir, String bookId) {
        Pattern pattern = Pattern.compile("<binary[^>]+id=\"(.*?)\"[^>]*>(.*?)</binary>", Pattern.DOTALL);
        Matcher matcher = pattern.matcher(content);

        String coverTag = extractTagContent(content, "<coverpage>", "</coverpage>");
        if (coverTag == null) return;

        while (matcher.find()) {
            String imageId = matcher.group(1).replaceAll("__+", "_");
            String base64Data = matcher.group(2).replaceAll("\\s+", "");


            if (coverTag.contains("xlink:href=\"#" + imageId + "\"")) {
                String outputPath = outputDir + bookId + "_cover.jpg";
                saveImage(base64Data, outputPath);
                break;
            }
        }
    }



    private void extractAndSaveImages(String content, String outputDir, String bookId) {
        Pattern pattern = Pattern.compile("<binary[^>]+id=\"(.*?)\"[^>]*>(.*?)</binary>", Pattern.DOTALL);
        Matcher matcher = pattern.matcher(content);

        String coverTag = extractTagContent(content, "<coverpage>", "</coverpage>");

        while (matcher.find()) {
            String imageId = matcher.group(1).replaceAll("__+", "_"); // Исправляем "__" → "_"
            String base64Data = matcher.group(2).replaceAll("\\s+", ""); // Убираем пробелы


            if (coverTag == null || !coverTag.contains("xlink:href=\"#" + imageId + "\"")) {
                String uniqueImageName = bookId + "_" + imageId + ".jpg";
                saveImage(base64Data, outputDir + uniqueImageName);
            }
        }
    }
















    private void saveImage(String base64Data, String outputPath) {
        try {
            byte[] decodedBytes = Base64.getDecoder().decode(base64Data);
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(decodedBytes));

            if (img != null) {
                File outputFile = new File(outputPath);


                if (outputFile.getName().endsWith(".jpg.jpg")) {
                    outputPath = outputPath.replace(".jpg.jpg", ".jpg");
                    outputFile = new File(outputPath);
                }

                outputFile.getParentFile().mkdirs();

                ImageIO.write(img, "jpg", outputFile);
                System.out.println("✅ Изображение сохранено без двойного расширения: " + outputPath);
            } else {
                System.err.println("❌ Ошибка: не удалось декодировать изображение.");
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }




    private BufferedImage resizeImage(BufferedImage originalImage, int targetWidth, int targetHeight) {
        Image resultingImage = originalImage.getScaledInstance(targetWidth, targetHeight, Image.SCALE_SMOOTH);
        BufferedImage outputImage = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
        outputImage.getGraphics().drawImage(resultingImage, 0, 0, null);
        return outputImage;
    }
    private List<String> extractGenres(String content) {
        List<String> genres = new ArrayList<>();
        int start = content.indexOf("<genre>");
        while (start != -1) {
            int end = content.indexOf("</genre>", start);
            if (end != -1) {
                String genre = content.substring(start + "<genre>".length(), end).trim();
                genres.add(formatGenre(genre));
                start = content.indexOf("<genre>", end);
            } else {
                break;
            }
        }
        return genres;
    }

    private String formatGenre(String genre) {

        genre = genre.replace("_", " ");

        return Arrays.stream(genre.split(" "))
                .map(word -> word.substring(0, 1).toUpperCase() + word.substring(1).toLowerCase())
                .collect(Collectors.joining(" "));
    }

    public List<String> paginateContent(String content, int targetWordCount, boolean twoPageMode) {
        // Удаляем обложку из контента
        content = content.replaceAll("(?s)<div class='cover-page'>.*?</div>\\s*", "")
                .replaceAll("(?s)<div class='page' id='firstPage'>(.*?)</div>", "$1")
                .replaceAll("\\s+", " ")
                .trim();

        String[] words = content.split("\\s+");
        List<String> pages = new ArrayList<>();

        int currentIndex = 0;
        int totalWordsProcessed = 0;

        while (currentIndex < words.length) {
            // Определяем конец страницы
            int pageEnd = Math.min(currentIndex + targetWordCount, words.length);

            // Корректировка до конца предложения
            while (pageEnd < words.length &&
                    !isSentenceBoundary(words[pageEnd - 1]) &&
                    pageEnd - currentIndex < targetWordCount + 20) {
                pageEnd++;
            }

            // Создаем контент страницы
            String pageContent = String.join(" ",
                    Arrays.copyOfRange(words, currentIndex, pageEnd)
            );

            pages.add(pageContent);

            // Подсчет слов
            int pageWordsCount = pageContent.split("\\s+").length;

            // Логирование
            System.err.println("Страница " + (pages.size()) + " (одностраничный режим):");
            System.err.println("  Количество слов: " + pageWordsCount + " слов");
            System.err.println("  Диапазон слов: " + currentIndex + "-" + pageEnd);
            System.err.flush();

            totalWordsProcessed += pageWordsCount;

            // Обновляем индекс для следующей страницы
            currentIndex = pageEnd;
        }

        // Финальная статистика
        System.err.println("\n=== ИТОГО ===");
        System.err.println("Всего слов в тексте: " + words.length);
        System.err.println("Обработано слов: " + totalWordsProcessed);
        System.err.println("Количество страниц: " + pages.size());
        System.err.flush();

        return pages;
    }





    private boolean isSentenceEnd(char c) {
        return c == '.' || c == '!' || c == '?' || c == '\n';
    }
    public List<String> paginateTwoPageMode(String content, int wordsPerScreen) {
        // Удаляем обложку из контента
        content = content.replaceAll("(?s)<div class='cover-page'>.*?</div>\\s*", "")
                .replaceAll("(?s)<div class='page' id='firstPage'>(.*?)</div>", "$1")
                .replaceAll("\\s+", " ")
                .trim();

        String[] words = content.split("\\s+");
        List<String> pages = new ArrayList<>();

        int currentIndex = 0;
        int totalWordsProcessed = 0;

        while (currentIndex < words.length) {
            // Точное количество слов для страницы
            int totalPageWords = wordsPerScreen;

            // Разделение слов между левой и правой колонками
            int leftColumnWords = totalPageWords / 2;
            int rightColumnWords = totalPageWords - leftColumnWords;

            // Индексы для левой колонки
            int leftColumnEnd = Math.min(currentIndex + leftColumnWords, words.length);

            // Корректировка до конца предложения для левой колонки
            while (leftColumnEnd < words.length &&
                    !isSentenceBoundary(words[leftColumnEnd - 1]) &&
                    leftColumnEnd - currentIndex < leftColumnWords + 10) {
                leftColumnEnd++;
            }

            // Индексы для правой колонки
            int rightColumnStart = leftColumnEnd;
            int rightColumnEnd = Math.min(rightColumnStart + rightColumnWords, words.length);

            // Корректировка до конца предложения для правой колонки
            while (rightColumnEnd < words.length &&
                    (!isSentenceBoundary(words[rightColumnEnd - 1]) ||
                            isChapterHeaderSplit(words, currentIndex, rightColumnEnd)) &&
                    rightColumnEnd - rightColumnStart < rightColumnWords + 10) {
                rightColumnEnd++;
            }

            // Создаем HTML для двухколоночной страницы
            String leftColumn = String.join(" ",
                    Arrays.copyOfRange(words, currentIndex, leftColumnEnd)
            );
            String rightColumn = String.join(" ",
                    Arrays.copyOfRange(words, rightColumnStart, rightColumnEnd)
            );

            String pageHtml = "<div class='two-column'>" +
                    "<div class='column left'><p>" + leftColumn + "</p></div>" +
                    "<div class='column right'><p>" + rightColumn + "</p></div>" +
                    "</div>";

            pages.add(pageHtml);

            // Подсчет слов
            int leftColumnWordsCount = leftColumn.split("\\s+").length;
            int rightColumnWordsCount = rightColumn.split("\\s+").length;
            int pageWordsCount = leftColumnWordsCount + rightColumnWordsCount;

            // Логирование
            System.err.println("Страница " + (pages.size()) + " (двухстраничный режим):");
            System.err.println("  Левая колонка: " + leftColumnWordsCount + " слов");
            System.err.println("  Правая колонка: " + rightColumnWordsCount + " слов");
            System.err.println("  Всего на странице: " + pageWordsCount + " слов");
            System.err.println("  Диапазон слов: " + currentIndex + "-" + rightColumnEnd);
            System.err.flush();

            totalWordsProcessed += pageWordsCount;

            // Обновляем индекс для следующей страницы
            currentIndex = rightColumnEnd;
        }

        // Финальная статистика
        System.err.println("\n=== ИТОГО ===");
        System.err.println("Всего слов в тексте: " + words.length);
        System.err.println("Обработано слов: " + totalWordsProcessed);
        System.err.println("Количество страниц: " + pages.size());
        System.err.flush();

        return pages;
    }
    private boolean isChapterHeaderSplit(String[] words, int currentIndex, int pageEnd) {
        // Проверяем каждое слово в диапазоне
        for (int i = currentIndex; i < pageEnd; i++) {
            // Проверяем наличие HTML-тега заголовка главы
            if (containsChapterHeader(words[i])) {
                return true;
            }
        }
        return false;
    }

    private boolean containsChapterHeader(String word) {
        // Проверка на наличие тега h3 и текста "Глава"
        return word.contains("<h3") &&
                (word.contains("Глава") || word.matches(".*Глава\\s+\\d+.*"));
    }
    private boolean isSentenceBoundary(String word) {
        return word.endsWith(".") ||
                word.endsWith("!") ||
                word.endsWith("?") ||
                word.endsWith(";") ||
                word.endsWith(":") ||
                word.endsWith(",");
    }


    public int findPageByTextFragment(String content, String fragment, int wordsPerScreen, boolean twoPageMode) {
        // Очищаем HTML-теги из фрагмента
        String cleanFragment = fragment.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase();

        // Если фрагмент слишком короткий, возвращаем -1
        if (cleanFragment.length() < 30) {
            return -1;
        }

        // Получаем все страницы с применением текущей пагинации
        List<String> pages = twoPageMode
                ? paginateTwoPageMode(content, wordsPerScreen)
                : paginateContent(content, wordsPerScreen, twoPageMode);

        // Ищем фрагмент на каждой странице
        for (int i = 0; i < pages.size(); i++) {
            String pageContent = pages.get(i)
                    .replaceAll("<[^>]+>", " ")
                    .replaceAll("\\s+", " ")
                    .trim()
                    .toLowerCase();

            if (pageContent.contains(cleanFragment)) {
                return twoPageMode && i == 0 ? 0 : i + 1;// +1 так как страницы начинаются с 1 (или с 0 для обложки в двухстраничном режиме)
            }
        }

        // Если точное совпадение не найдено, ищем частичное совпадение
        // Берем первые 50-100 символов из фрагмента для поиска
        if (cleanFragment.length() > 50) {
            String shorterFragment = cleanFragment.substring(0, Math.min(100, cleanFragment.length()));

            for (int i = 0; i < pages.size(); i++) {
                String pageContent = pages.get(i)
                        .replaceAll("<[^>]+>", " ")
                        .replaceAll("\\s+", " ")
                        .trim()
                        .toLowerCase();

                if (pageContent.contains(shorterFragment)) {
                    return twoPageMode && i == 0 ? 0 : i + 1;
                }
            }
        }

        // Если и частичное совпадение не найдено, возвращаем -1
        return -1;
    }

    /**
     * Определяет относительную позицию (от 0 до 1) текста в книге
     *
     * @param content полное содержимое книги
     * @param fragment фрагмент текста
     * @return относительная позиция от 0 до 1, или -1 если не найдено
     */
    public int findPageByTextFragmentInRange(String content, String fragment, int wordsPerScreen,
                                             boolean twoPageMode, int targetPage, int range) {
        // Основная логика как в findPageByTextFragment
        int exactPage = findPageByTextFragment(content, fragment, wordsPerScreen, twoPageMode);
        if (exactPage != -1) {
            return exactPage;
        }

        // Если точное совпадение не найдено, проверяем соседние страницы в пределах указанного диапазона
        List<String> pages = twoPageMode
                ? paginateTwoPageMode(content, wordsPerScreen)
                : paginateContent(content, wordsPerScreen, twoPageMode);

        // Определяем диапазон страниц для поиска
        int startPage = Math.max(0, targetPage - range);
        int endPage = Math.min(pages.size() - 1, targetPage + range);

        // Очищаем HTML-теги из фрагмента
        String cleanFragment = fragment.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase();

        // Ищем на соседних страницах
        for (int i = startPage; i <= endPage; i++) {
            if (i == targetPage) continue; // Пропускаем целевую страницу, она уже проверена

            String pageContent = pages.get(i)
                    .replaceAll("<[^>]+>", " ")
                    .replaceAll("\\s+", " ")
                    .trim()
                    .toLowerCase();

            if (pageContent.contains(cleanFragment)) {
                return twoPageMode && i == 0 ? 0 : i + 1;
            }
        }

        return -1; // Не нашли ни на целевой странице, ни на соседних
    }
    public double getRelativePosition(String content, String fragment) {
        // Очищаем текст от HTML
        String cleanContent = content.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();

        String cleanFragment = fragment.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();

        // Ищем позицию фрагмента
        int position = cleanContent.indexOf(cleanFragment);
        if (position == -1) {
            return -1;
        }

        // Вычисляем относительную позицию
        return (double) position / cleanContent.length();
    }

    /**
     * Находит абсолютную позицию (индекс) фрагмента текста в книге
     *
     * @param content полное содержимое книги
     * @param fragment фрагмент текста
     * @return позиция начала фрагмента или -1, если не найден
     */
    public int getAbsolutePosition(String content, String fragment) {
        // Очищаем текст от HTML
        String cleanContent = content.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();

        String cleanFragment = fragment.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();

        // Возвращаем индекс начала фрагмента
        return cleanContent.indexOf(cleanFragment);
    }

    /**
     * Извлекает контекст вокруг фрагмента текста
     *
     * @param content полное содержимое книги
     * @param fragment фрагмент текста
     * @param contextLength длина контекста до и после фрагмента (в символах)
     * @return объект с контекстом до и после фрагмента
     */
    public Map<String, String> extractTextContext(String content, String fragment, int contextLength) {
        Map<String, String> result = new HashMap<>();

        // Очищаем текст от HTML
        String cleanContent = content.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();

        String cleanFragment = fragment.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();

        // Находим позицию фрагмента
        int position = cleanContent.indexOf(cleanFragment);
        if (position == -1) {
            result.put("before", "");
            result.put("after", "");
            return result;
        }

        // Извлекаем контекст до фрагмента
        int beforeStart = Math.max(0, position - contextLength);
        String before = cleanContent.substring(beforeStart, position);

        // Извлекаем контекст после фрагмента
        int afterEnd = Math.min(cleanContent.length(), position + cleanFragment.length() + contextLength);
        String after = cleanContent.substring(position + cleanFragment.length(), afterEnd);

        result.put("before", before);
        result.put("after", after);

        return result;
    }

    /**
     * Конвертирует абсолютную позицию в номер страницы
     *
     * @param content полное содержимое книги
     * @param position абсолютная позиция в тексте
     * @param wordsPerScreen количество слов на странице
     * @param twoPageMode режим отображения (одна/две страницы)
     * @return номер страницы, соответствующий позиции
     */
    public int getPageByPosition(String content, int position, int wordsPerScreen, boolean twoPageMode) {
        if (position < 0) {
            return twoPageMode ? 0 : 1; // По умолчанию первая страница
        }

        // Очищаем текст от HTML
        String cleanContent = content.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim();

        // Если позиция за пределами контента, возвращаем последнюю страницу
        if (position >= cleanContent.length()) {
            List<String> pages = twoPageMode
                    ? paginateTwoPageMode(content, wordsPerScreen)
                    : paginateContent(content, wordsPerScreen, twoPageMode);
            return pages.size();
        }

        // Получаем относительную позицию
        double relativePos = (double) position / cleanContent.length();

        // Получаем общее количество страниц
        List<String> pages = twoPageMode
                ? paginateTwoPageMode(content, wordsPerScreen)
                : paginateContent(content, wordsPerScreen, twoPageMode);

        // Вычисляем номер страницы по относительной позиции
        int page = (int) Math.ceil(relativePos * pages.size());

        // Корректируем страницу для разных режимов
        if (twoPageMode) {
            return Math.max(0, page);
        } else {
            return Math.max(1, page);
        }
    }

    /**
     * Ищет заметку с наилучшим совпадением на всех страницах книги
     *
     * @param content полное содержимое книги
     * @param noteText текст заметки
     * @param wordsPerScreen количество слов на странице
     * @param twoPageMode режим отображения (одна/две страницы)
     * @return наилучшая найденная страница или -1, если совпадений нет
     */
    public int findBestMatchingPage(String content, String noteText, int wordsPerScreen, boolean twoPageMode) {
        // Сначала проверяем точное совпадение
        int exactPage = findPageByTextFragment(content, noteText, wordsPerScreen, twoPageMode);
        if (exactPage != -1) {
            return exactPage;
        }

        // Если точное совпадение не найдено, пробуем найти наилучшее частичное совпадение
        String cleanNote = noteText.replaceAll("<[^>]+>", " ")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase();

        // Разбиваем заметку на фразы
        String[] phrases = cleanNote.split("[.!?]");

        // Ищем наиболее уникальные фразы (длиннее 10 символов)
        List<String> searchPhrases = new ArrayList<>();
        for (String phrase : phrases) {
            phrase = phrase.trim();
            if (phrase.length() > 10) {
                searchPhrases.add(phrase);
            }
        }

        // Если нет подходящих фраз, берем начало заметки
        if (searchPhrases.isEmpty() && cleanNote.length() > 15) {
            searchPhrases.add(cleanNote.substring(0, Math.min(50, cleanNote.length())));
        }

        // Ищем каждую фразу и выбираем наиболее часто встречающуюся страницу
        Map<Integer, Integer> pageOccurrences = new HashMap<>();
        int bestPage = -1;
        int maxOccurrences = 0;

        for (String phrase : searchPhrases) {
            int page = findPageByTextFragment(content, phrase, wordsPerScreen, twoPageMode);
            if (page != -1) {
                int count = pageOccurrences.getOrDefault(page, 0) + 1;
                pageOccurrences.put(page, count);

                if (count > maxOccurrences) {
                    maxOccurrences = count;
                    bestPage = page;
                }
            }
        }

        return bestPage;
    }





    public int countWords(String text) {
        return text.trim().isEmpty() ? 0 : text.trim().split("\\s+").length;
    }









}