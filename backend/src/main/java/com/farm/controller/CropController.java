package com.farm.controller;

import com.farm.entity.Crop;
import com.farm.repository.CropRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/crops")
@CrossOrigin
public class CropController {
    private final CropRepository cropRepository;
    public CropController(CropRepository cropRepository) { this.cropRepository = cropRepository; }

    @GetMapping
    public List<Crop> getAll() { return cropRepository.findAll(); }

    @GetMapping("/{id}")
    public ResponseEntity<Crop> getById(@PathVariable Long id) {
        return cropRepository.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Crop create(@RequestBody Crop crop) { return cropRepository.save(crop); }

    @PutMapping("/{id}")
    public ResponseEntity<Crop> update(@PathVariable Long id, @RequestBody Crop update) {
        return cropRepository.findById(id).map(c -> {
            c.setName(update.getName());
            c.setVariety(update.getVariety());
            c.setArea(update.getArea());
            c.setPlantingDate(update.getPlantingDate());
            c.setHarvestDate(update.getHarvestDate());
            c.setNotes(update.getNotes());
            return ResponseEntity.ok(cropRepository.save(c));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!cropRepository.existsById(id)) return ResponseEntity.notFound().build();
        cropRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}


