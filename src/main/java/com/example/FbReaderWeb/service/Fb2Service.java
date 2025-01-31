package com.example.FbReaderWeb.service;
import com.example.FbReaderWeb.model.User;
import com.example.FbReaderWeb.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
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
import java.util.stream.Collectors;




@Service
public class Fb2Service {

    private final EbookRepository ebookRepository;
    private final UserRepository userRepository;

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
        // Генерация уникального идентификатора для книги
        String bookId = UUID.randomUUID().toString();

        // Создание временной директории
        Path tempDir = Files.createTempDirectory("fb2_temp");

        // Директория для сохранения изображений
        String outputDir = new File("src/main/resources/static/images").getAbsolutePath() + File.separator;

        // Временный файл для FB2
        File tempFile = new File(tempDir.toString(), "temp.fb2");
        file.transferTo(tempFile);

        // Чтение содержимого FB2 файла
        String charset = detectCharset(tempFile.getAbsolutePath());
        String content = readText(tempFile.getAbsolutePath(), charset);

        // Извлечение метаданных
        String title = extractTagContent(content, "<book-title>", "</book-title>");
        title = title != null ? stripTags(title) : "Неизвестное название";

        String author = extractAuthor(content);

        // Обработка изображений и текста
        String parsedContent = parseFb2(content, outputDir, bookId);

        // Извлечение жанров
        List<String> genres = extractGenres(content);
        List<String> uniqueGenres = genres.stream().distinct().collect(Collectors.toList());

        // Сохранение книги в базу данных
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        Ebook ebook = saveEbookToDatabase(title, author, parsedContent);
        ebook.setGenres(uniqueGenres);
        ebook.setUser(user); // Связываем книгу с пользователем
        ebookRepository.save(ebook);

        // Асинхронное сохранение изображений
        extractAndSaveImagesAsync(content, outputDir, bookId);

        // Удаление временных файлов
        Files.walk(tempDir).sorted(Comparator.reverseOrder()).map(Path::toFile).forEach(File::delete);

        return ebook.getId().toString(); // Возвращаем ID книги
    }




    private Ebook saveEbookToDatabase(String title, String author, String content) {
        Ebook ebook = new Ebook();
        ebook.setTitle(title);
        ebook.setAuthor(author);
        ebook.setContent(content);
        return ebookRepository.save(ebook); // Сохраняем и возвращаем книгу
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

    private String parseFb2(String content, String outputDir, String bookId) {
        // Сохраняем изображения
        extractAndSaveImages(content, outputDir, bookId);

        // Извлекаем название книги
        String title = extractTagContent(content, "<book-title>", "</book-title>");
        title = (title != null) ? title.trim() : "Без названия";

        // Извлекаем автора
        String authorTag = extractTagContent(content, "<author>", "</author>");
        String firstName = (authorTag != null) ? extractTagContent(authorTag, "<first-name>", "</first-name>") : "";
        String lastName = (authorTag != null) ? extractTagContent(authorTag, "<last-name>", "</last-name>") : "";
        String author = ((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim();
        if (author.isEmpty()) {
            author = "Неизвестный автор";
        }

        // Извлекаем обложку
        String coverImageHtml = "";
        String coverTag = extractTagContent(content, "<coverpage>", "</coverpage>");
        if (coverTag != null) {
            String coverHref = extractTagContent(coverTag, "l:href=\"#", "\"");
            if (coverHref != null) {
                coverImageHtml = "<div style=\"display: flex; justify-content: center;\">" +
                        "    <img src=\"/images/" + bookId + "_" + coverHref + ".jpg\" alt=\"Cover\" " +
                        "         style=\"max-width: 100%; height: auto; border-radius: 10px;\">" +
                        "</div>";
            }
        }

        // Извлекаем содержимое <body>
        String body = extractTagContent(content, "<body>", "</body>");
        body = body != null ? body : "";

        // Удаляем заголовок книги внутри <body> (если он совпадает с <book-title>)
        body = body.replaceAll("(?i)<title>\\s*<p>" + title + "</p>\\s*</title>", "");

        // Обновляем ссылки на изображения в тексте
        String updatedContent = body.replaceAll(
                "l:href=\"#(.*?)\"",
                "src=\"/images/" + bookId + "_$1.jpg\""
        );

        // Выделяем заголовки всех глав
        updatedContent = updatedContent.replaceAll("(?i)<title>\\s*<p>(.*?)</p>\\s*</title>", "<h3 style=\"text-align: center;\">$1</h3>");

        // Формируем итоговый HTML
        return "<div style=\"text-align: center;\">" +
                "    <h1 style=\"font-size: 2.5em; font-weight: bold;\">" + title + "</h1>" +
                "    <h2 style=\"font-size: 1.5em; font-weight: normal; color: gray;\">" + author + "</h2>" +
                coverImageHtml +
                "</div>" +
                updatedContent;
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
            return ""; // Возвращаем пустую строку вместо null
        }

        int end = content.indexOf(endTag, start + startTag.length());
        if (end == -1) {
            System.err.println("Тег " + endTag + " не найден!");
            return ""; // Возвращаем пустую строку вместо null
        }

        // Извлекаем текст между тегами
        return content.substring(start + startTag.length(), end).trim();
    }


    private String stripTags(String input) {
        return input.replaceAll("<[^>]+>", "").trim();
    }

    private void extractAndSaveImages(String content, String outputDir, String bookId) {
        int startBin = content.indexOf("<binary");
        int endBin = content.lastIndexOf("</binary>");

        if (startBin != -1 && endBin != -1) {
            String binarySection = content.substring(startBin, endBin + "</binary>".length());

            while (binarySection.contains("<binary")) {
                int nextBin = binarySection.indexOf("<binary");
                int lastBin = binarySection.indexOf("</binary>") + "</binary>".length();
                String binaryEl = binarySection.substring(nextBin, lastBin);

                binarySection = binarySection.replace(binaryEl, "");
                binaryEl = binaryEl.replace("</binary>", "");

                // Извлекаем id изображения
                String tag = binaryEl.substring(0, binaryEl.indexOf(">") + 1);
                binaryEl = binaryEl.replace(tag, "");
                String imageId = tag.substring(tag.indexOf("id=") + 4, tag.indexOf("\"", tag.indexOf("id=") + 4));

                // Уникальное имя файла
                String uniqueImageName = bookId + "_" + imageId + ".jpg";
                saveImage(binaryEl, outputDir + uniqueImageName);

            }
        }
    }

    private void saveImage(String base64Data, String outputPath) {
        try {
            byte[] decodedBytes = Base64.getMimeDecoder().decode(base64Data);
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(decodedBytes));

            if (img != null) {
                int targetWidth = 800; // Ограничение по ширине
                int targetHeight = 600; // Ограничение по высоте

                BufferedImage resizedImg = resizeImage(img, 1200, 1800);
                ImageIO.write(resizedImg, "jpg", new File(outputPath));
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
                genres.add(formatGenre(genre)); // Применяем форматирование
                start = content.indexOf("<genre>", end);
            } else {
                break;
            }
        }
        return genres;
    }

    private String formatGenre(String genre) {
        // Заменяем нижние подчеркивания пробелами
        genre = genre.replace("_", " ");
        // Делаем каждое слово с заглавной буквы
        return Arrays.stream(genre.split(" "))
                .map(word -> word.substring(0, 1).toUpperCase() + word.substring(1).toLowerCase())
                .collect(Collectors.joining(" "));
    }

    public List<String> paginateContent(String content, int targetWordCount) {
        List<String> pages = new ArrayList<>();
        int start = 0;

        while (start < content.length()) {
            int end = start;
            int wordCount = 0;

            // Набираем слова до достижения targetWordCount
            while (end < content.length() && wordCount < targetWordCount) {
                char c = content.charAt(end);
                if (Character.isWhitespace(c) || isSentenceEnd(c)) {
                    wordCount++;
                }
                end++;
            }

            // Удостоверяемся, что страница заканчивается на целое предложение
            while (end < content.length() && !isSentenceEnd(content.charAt(end))) {
                end++;
            }

            String page = content.substring(start, end).trim();
            pages.add(page);
            start = end + 1;
        }

        return pages;
    }

    // Функция проверяет, является ли символ концом предложения



    // Функция проверяет, является ли символ концом предложения
    private boolean isSentenceEnd(char c) {
        return c == '.' || c == '!' || c == '?' || c == '\n';
    }
    public int countWords(String text) {
        return text.trim().isEmpty() ? 0 : text.trim().split("\\s+").length;
    }









}
